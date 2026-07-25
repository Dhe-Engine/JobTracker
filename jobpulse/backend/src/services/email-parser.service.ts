/*
what this service does:
    - classifies emails using Gemini AI to detect job application confirmations
    - extracts company name and role from the email
    - provides a heuristic fallback when Gemini is unavailable
    - throws GeminiUnavailableError so the worker can quarantine failed emails
      instead of silently discarding them
*/

import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../core/config";
import type { EmailMetadata, ParsedEmail } from "../models/application.model";


// ─────────────────────────────────────────────────────────────────────────────
// GEMINI CLIENT
// Created once and reused for every classification call.
// ─────────────────────────────────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const model = genAI.getGenerativeModel(
  { model: config.gemini.model },
  { apiVersion: "v1" } 
);


// ─────────────────────────────────────────────────────────────────────────────
// TYPED ERROR CLASS
//
// Why this exists:
//   When classifyEmail() fails, the caller needs to know WHY it failed.
//
//   Case A: Gemini API was unavailable (503, timeout, rate limit)
//           → The email should be QUARANTINED and retried later.
//           → We have not made a classification decision yet.
//
//   Case B: Gemini said "is_job_application: false"
//           → This IS a classification decision — discard the email.
//
//   Without this typed error, the worker cannot tell A from B.
//   With it, the worker catches GeminiUnavailableError specifically
//   and routes the email to the quarantine holding room.
// ─────────────────────────────────────────────────────────────────────────────

export class GeminiUnavailableError extends Error {
  constructor(
    message: string,
    // reason is stored on the quarantine row so you know what went wrong
    public readonly reason: "gemini_unavailable" | "gemini_parse_error" = "gemini_unavailable"
  ) {
    super(message);
    this.name = "GeminiUnavailableError";
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
//
// Key design decisions:
//   1. Lenient-by-default — err toward true when uncertain.
//      A missed application is worse than a false positive.
//   2. Positive examples included — LLMs classify better with examples.
//   3. ATS domains treated as strong signals.
//   4. Rejection emails count as applications — we still want to track
//      that the person applied even if they were rejected.
//   5. Strict JSON-only output — no markdown, no preamble.
// ─────────────────────────────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert email classifier for a job application tracking app.

Your task: decide if an email is a job application CONFIRMATION sent to a job seeker after they submitted an application.

## What counts as a job application confirmation (return is_job_application: true)

Include ANY email that confirms a job application was received or submitted. These come in many forms:

**Direct confirmations:**
- "Thank you for applying to [Company]"
- "We received your application for [Role]"
- "Your application has been submitted"
- "Application submitted successfully"
- "We've received your application"
- "Thank you for your interest in [Role] at [Company]"
- "Thank you for applying with [Company]"

**ATS system confirmations** (from Greenhouse, Workday, Lever, Ashby, iCIMS etc.):
- Emails from domains like greenhouse-mail.io, myworkdayjobs.com, lever.co, ashbyhq.com
- These almost always confirm receipt of an application

**Implicit confirmations:**
- Any email referencing a job title + confirmation language
- "We will review your application and be in touch"
- "Our team will review your qualifications"

## What does NOT count (return is_job_application: false)

Only exclude when clearly one of these:
- Job alert emails or newsletters ("New jobs matching your search")
- Cold recruiter outreach asking if you are open to opportunities
- Calendar invites or interview scheduling (application was already tracked)
- Account creation or profile setup emails with no application reference

## IMPORTANT RULES

1. When in doubt, return true — a false negative is worse than a false positive
2. Use the email body — subject lines alone can be misleading
3. ATS domains are strong signals — greenhouse-mail.io, ashbyhq.com, lever.co etc.
   almost always mean a job application confirmation
4. Rejection emails ARE application confirmations — if someone applied and got
   rejected, we still want to track that they applied. Return is_job_application: true
   for rejection emails too, with role and company extracted.
5. Extract company from the HIRING company name, NOT the ATS provider name

## Output format

Respond ONLY with a JSON object. No explanation, no markdown, no code fences.

{
  "is_job_application": boolean,
  "company": string or null,
  "role": string or null,
  "confidence": "high" or "medium" or "low"
}

- company: the hiring company (e.g. "Google", "Imagine Pediatrics") — not the ATS platform
- role: the specific job title applied for, if mentioned in the email
- confidence: high = very certain, medium = probably correct, low = guessing`;


// ─────────────────────────────────────────────────────────────────────────────
// GEMINI RETRY WRAPPER
//
// Gemini occasionally returns 503 when demand spikes.
// We retry once with a short delay before giving up and quarantining.
// Only one retry here — quarantine handles longer-term retries
// so we don't block the worker for too long on each email.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 2;       // initial attempt + 1 retry
const RETRY_DELAY_MS = 2000;    // 2 seconds between attempts

async function callGeminiWithRetry(userMessage: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        systemInstruction: CLASSIFICATION_SYSTEM_PROMPT,
        generationConfig: {
          // Low temperature = consistent, predictable JSON output
          temperature: 0.1,
          maxOutputTokens: 256,
        },
      });

      return result.response.text();

    } catch (err: any) {
      lastError = err;

      const is503 =
        err?.message?.includes("503") ||
        err?.message?.includes("Service Unavailable") ||
        err?.message?.includes("high demand");

      // so retrying in 2 seconds won't help. Quarantine and try hours later.
      const is429 =
        err?.message?.includes("429") ||
        err?.message?.includes("Too Many Requests") ||
        err?.message?.includes("quota");

      if (is429) {
        console.warn(
          "[email-parser] Gemini quota exceeded (429) — will quarantine for retry later"
        );
        throw err; // throw immediately, no point retrying
      }

      if (!is503) {
        // Non-503 error (auth, quota exceeded etc.) — don't retry, throw immediately
        throw err;
      }

      if (attempt < MAX_RETRIES) {
        console.warn(
          `[email-parser] Gemini 503 on attempt ${attempt}/${MAX_RETRIES}. ` +
          `Retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // All attempts exhausted — throw the last error
  throw lastError;
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: classifyEmail
//
// Two possible outcomes:
//   1. Returns a ParsedEmail — Gemini successfully classified the email.
//      The result may be is_job_application: true OR false.
//      Both are valid classification outcomes.
//
//   2. Throws GeminiUnavailableError — Gemini could not be reached.
//      The caller should quarantine the email for retry later.
//      This is NOT a classification — we simply don't know yet.
// ─────────────────────────────────────────────────────────────────────────────

export async function classifyEmail(
  email: EmailMetadata
): Promise<ParsedEmail> {

  // Build the user message with full context.
  // Truncate body to 2000 chars — enough for classification, keeps costs low.
  const bodyPreview = email.body
    ? email.body.slice(0, 2000).trim()
    : "(no body content available)";

  const userMessage =
    `Subject: ${email.subject}
From: ${email.from}

Email body:
${bodyPreview}`;

  try {
    const rawText = await callGeminiWithRetry(userMessage);
    return parseGeminiResponse(rawText, email);

  } catch (err: any) {

    // Log which email failed and why — visible in Railway logs
    console.error("[email-parser] Gemini classification failed:", {
      subject: email.subject,
      from: email.from,
      error: err?.message ?? String(err),
    });

    // Determine if this is an API availability error or something else
    const isApiError =
      err?.message?.includes("503") ||
      err?.message?.includes("Service Unavailable") ||
      err?.message?.includes("high demand") ||
      err?.message?.includes("429") ||
      err?.message?.includes("Too Many Requests") ||
      err?.message?.includes("quota") ||
      err?.message?.includes("GoogleGenerativeAI") ||
      err?.message?.includes("timeout") ||
      err?.message?.includes("fetch");

    // Throw a typed error so the worker knows to quarantine this email.
    // The quarantine service will retry it before end of day.
    if (isApiError) {
      throw new GeminiUnavailableError(err.message, "gemini_unavailable");
    }

    // Non-API error (unexpected) — also quarantine rather than silently drop
    throw new GeminiUnavailableError(err.message, "gemini_parse_error");
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// PARSE GEMINI RESPONSE
//
// Parses the raw text from Gemini into a typed ParsedEmail object.
// Includes a heuristic override: if Gemini returned false but the
// subject or sender clearly matches a known confirmation pattern,
// we override to true with medium confidence.
// ─────────────────────────────────────────────────────────────────────────────

function parseGeminiResponse(
  rawText: string,
  email: EmailMetadata
): ParsedEmail {

  // Strip any accidental markdown formatting Gemini might add
  const cleaned = rawText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[email-parser] Could not parse Gemini response as JSON:", rawText);
  }

  if (parsed && typeof parsed.is_job_application === "boolean") {

    const result: ParsedEmail = {
      is_job_application: parsed.is_job_application as boolean,
      company: typeof parsed.company === "string" ? parsed.company : null,
      role: typeof parsed.role === "string" ? parsed.role : null,
      confidence: validateConfidence(parsed.confidence),
    };

    // Heuristic override:
    // If Gemini returned false but the email clearly matches known confirmation
    // patterns (subject line or ATS sender domain), trust the heuristic.
    // This catches cases where Gemini was overly cautious with limited context.
    if (!result.is_job_application && isObviousConfirmation(email)) {
      console.log(
        "[email-parser] Heuristic override: Gemini returned false but " +
        "subject or sender matches known confirmation pattern — overriding to true",
        { subject: email.subject, from: email.from }
      );
      return {
        ...result,
        is_job_application: true,
        confidence: "medium",
      };
    }

    return result;
  }

  // Gemini response was unparseable — use heuristic as final fallback
  console.warn(
    "[email-parser] Gemini returned unparseable response — falling back to heuristic",
    { rawText }
  );

  if (isObviousConfirmation(email)) {
    return {
      is_job_application: true,
      company: extractCompanyFromSender(email.from),
      role: null,
      confidence: "medium",
    };
  }

  // Cannot determine — return false (Gemini did respond, just unparseable)
  return {
    is_job_application: false,
    company: null,
    role: null,
    confidence: "low",
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// HEURISTIC: isObviousConfirmation
//
// Fast regex + ATS domain check used as a safety net in two places:
//   1. When Gemini returns false but we suspect it's wrong
//   2. When Gemini's JSON is unparseable
//
// Does NOT replace Gemini — only corrects obvious errors.
// ─────────────────────────────────────────────────────────────────────────────

// Known ATS email sender domains.
// Emails from these domains almost always confirm a submitted application.
const ATS_SENDER_DOMAINS = new Set([
  "greenhouse-mail.io",
  "greenhouse.io",
  "myworkdayjobs.com",
  "workday.com",
  "lever.co",
  "ashbyhq.com",
  "icims.com",
  "jobvite.com",
  "smartrecruiters.com",
  "bamboohr.com",
  "taleo.net",
  "successfactors.com",
  "breezy.hr",
  "recruitee.com",
  "workable.com",
  "jazz.co",
  "pinpointhq.com",
  "teamtailor.com",
  "paylocity.com",
  "paycom.com",
  "hire.com",
  "applytojob.com",
]);

// Subject line patterns that strongly indicate a job application confirmation
const CONFIRMATION_SUBJECT_PATTERNS = [
  /thank you for applying/i,
  /thanks for applying/i,
  /application received/i,
  /we received your application/i,
  /your application (has been|was) (received|submitted)/i,
  /application submitted/i,
  /application confirmation/i,
  /thank you for your (interest|application)/i,
  /thank you for applying (to|with|for)/i,
  /we.ve received your application/i,
  /application update/i,
  /your application to/i,
  /application for .+ (at|with)/i,
];

export function isObviousConfirmation(email: EmailMetadata): boolean {

  // Check subject line against known confirmation patterns
  if (CONFIRMATION_SUBJECT_PATTERNS.some((pattern) => pattern.test(email.subject))) {
    return true;
  }

  // Check sender domain against known ATS platforms
  const emailMatch =
    email.from.match(/<(.+)>/) ?? email.from.match(/(\S+@\S+)/);

  if (emailMatch) {
    const senderEmail = emailMatch[1] ?? emailMatch[0];
    const senderDomain = senderEmail.split("@")[1]?.toLowerCase() ?? "";

    // Exact domain match
    if (ATS_SENDER_DOMAINS.has(senderDomain)) return true;

    // Subdomain match (e.g. mail.greenhouse.io)
    for (const atsDomain of ATS_SENDER_DOMAINS) {
      if (senderDomain.endsWith(`.${atsDomain}`)) return true;
    }
  }

  return false;
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: extractCompanyFromSender
//
// Fallback used when Gemini does not extract the company name.
// Tries to read the company from the email display name first
// (e.g. "Imagine Pediatrics Recruiting <no-reply@greenhouse-mail.io>"),
// then falls back to the sender domain.
// ─────────────────────────────────────────────────────────────────────────────

// ATS provider domains — these are NOT the company, skip to display name
const ATS_DOMAINS_TO_SKIP = new Set([
  "greenhouse-mail.io",
  "greenhouse.io",
  "myworkdayjobs.com",
  "workday.com",
  "lever.co",
  "ashbyhq.com",
  "icims.com",
  "jobvite.com",
  "smartrecruiters.com",
  "bamboohr.com",
]);

export function extractCompanyFromSender(from: string): string {

  const emailMatch = from.match(/<(.+)>/) ?? from.match(/(\S+@\S+)/);
  if (!emailMatch) return "Unknown Company";

  const emailAddress = emailMatch[1] ?? emailMatch[0];
  const domain = emailAddress.split("@")[1]?.toLowerCase() ?? "";

  // If the sender is an ATS provider, try the display name instead
  // e.g. "Imagine Pediatrics Recruiting <no-reply@greenhouse-mail.io>"
  // → extract "Imagine Pediatrics" from the display name
  if (ATS_DOMAINS_TO_SKIP.has(domain)) {
    const displayNameMatch = from.match(/^([^<]+)</);
    if (displayNameMatch) {
      const displayName = displayNameMatch[1].trim();
      // Remove common suffixes that are not the company name
      const cleaned = displayName
        .replace(/\s+(recruiting|careers|hr|hiring|team|jobs|noreply|no-reply)$/i, "")
        .trim();
      if (cleaned) return cleaned;
    }
    return "Unknown Company";
  }

  // Extract from domain: careers.google.com → Google
  // jobs.amazon.co.uk → Amazon
  const parts = domain.split(".");
  const companyPart = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

  return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
}


// ─────────────────────────────────────────────────────────────────────────────
// HELPER: validateConfidence
// Ensures the confidence value from Gemini is one of the expected values.
// Defaults to "low" if Gemini returns something unexpected.
// ─────────────────────────────────────────────────────────────────────────────

function validateConfidence(raw: unknown): "high" | "medium" | "low" {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "low";
}


// ─────────────────────────────────────────────────────────────────────────────
// classifyEmailBatch
// Processes a list of emails one at a time with a short pause between each.
// Used for bulk historical email scanning.
// ─────────────────────────────────────────────────────────────────────────────

export async function classifyEmailBatch(
  emails: EmailMetadata[]
): Promise<Array<{ email: EmailMetadata; result: ParsedEmail }>> {

  const results: Array<{ email: EmailMetadata; result: ParsedEmail }> = [];

  for (const email of emails) {
    try {
      const result = await classifyEmail(email);
      results.push({ email, result });
    } catch (err) {
      // In batch mode, log and skip quarantined emails rather than stopping
      console.warn(
        "[email-parser] classifyEmailBatch: skipping email due to error:",
        { subject: email.subject, error: (err as Error).message }
      );
    }

    // 150ms pause between calls — prevents Gemini rate limiting on large batches
    await new Promise((r) => setTimeout(r, 150));
  }

  return results;
}