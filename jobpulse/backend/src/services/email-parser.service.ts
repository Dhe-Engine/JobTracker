/*
purpose:
    - send incoming emails metadata to gemini ai for classification
    - check if an email is a job application confirmation
    - extract the data: company, role, confidence
*/


import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../core/config";
import type { EmailMetadata, ParsedEmail } from "../models/application.model";
import { logger } from "../core/logger";


//initialize google clientge
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

//ai model
const model = genAI.getGenerativeModel({
    model: config.gemini.model,
})

//system prompt to define how gemini behaves
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
- Calendar invites or interview scheduling (the application was already tracked)
- Account creation / profile setup emails with no application reference

## IMPORTANT RULES

1. **When in doubt, return true** — a false negative (missing a real application) is worse than a false positive
2. **Use the email body** — subject lines alone can be misleading; read the body content
3. **ATS domains are strong signals** — greenhouse-mail.io, ashbyhq.com, lever.co etc. almost always mean a job application confirmation
4. **Rejection emails ARE application confirmations** — if someone applied and got rejected, we still want to track that they applied. Return is_job_application: true for rejection emails too, with role/company extracted.
5. Extract company from the hiring company name, NOT the ATS provider name

## Output format

Respond ONLY with a JSON object — no explanation, no markdown, no code fences.

{
  "is_job_application": boolean,
  "company": string or null,
  "role": string or null,
  "confidence": "high" or "medium" or "low"
}

- company: the hiring company (e.g. "Google", "Imagine Pediatrics") — not the ATS platform
- role: the specific job title applied for, if mentioned
- confidence: high = very certain, medium = probably correct, low = guessing`;


/*
|--------------------------------------------------------------------------
| classifyEmail
|--------------------------------------------------------------------------
|
| Uses Google's Gemini AI to decide whether an email is a real
| job application.
|
| Instead of looking only at the email subject, Gemini can also read
| part of the email body, giving it much more context.
|
| Example:
|
| Subject:
|   "Thanks for applying!"
|
| Body:
|   "We received your application for Software Engineer..."
|
| Gemini reads both and returns structured information like:
|
| {
|   is_job_application: true,
|   company: "Google",
|   role: "Software Engineer",
|   confidence: "high"
| }
|
| If Gemini cannot be reached, the function safely falls back and marks
| the email as NOT a confirmed application instead of crashing.
|
|--------------------------------------------------------------------------
*/

/**
 * Sends one email to Gemini AI for classification.
 *
 * @param email Complete email information.
 * @returns AI classification result.
 */
export async function classifyEmail(
  email: EmailMetadata
): Promise<ParsedEmail> {
  try {
    /*
    |--------------------------------------------------------------------------
    | Prepare the email body
    |--------------------------------------------------------------------------
    |
    | Very large emails cost more AI tokens.
    |
    | We only send the first 2,000 characters because that is usually
    | enough for Gemini to understand what the email is about.
    |
    |--------------------------------------------------------------------------
    */
    const bodyPreview = email.body
      ? email.body.slice(0, 2000).trim()
      : "(no body content available)";

    /*
    |--------------------------------------------------------------------------
    | Build the message sent to Gemini
    |--------------------------------------------------------------------------
    |
    | The AI receives:
    | • Subject
    | • Sender
    | • Email body
    |
    |--------------------------------------------------------------------------
    */
    const userMessage =
`Subject: ${email.subject}
From: ${email.from}

Email body:
${bodyPreview}`;

    /*
    |--------------------------------------------------------------------------
    | Ask Gemini to classify the email
    |--------------------------------------------------------------------------
    |
    | Temperature is kept very low so Gemini gives consistent,
    | predictable answers instead of creative ones.
    |
    |--------------------------------------------------------------------------
    */
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      systemInstruction: CLASSIFICATION_SYSTEM_PROMPT,
      generationConfig: {
        // Lower temperature = more reliable JSON
        temperature: 0.1,

        // Small output because we only expect structured JSON
        maxOutputTokens: 256,
      },
    });

    // Gemini returns plain text which should contain JSON
    const rawText = result.response.text();

    // Parse and validate Gemini's response
    return parseGeminiResponse(rawText, email);

  } catch (err) {
    /*
    |--------------------------------------------------------------------------
    | Gemini request failed
    |--------------------------------------------------------------------------
    |
    | This could happen because of:
    | • Network problems
    | • API outage
    | • Rate limits
    |
    | Rather than crashing, we return a safe fallback.
    |
    |--------------------------------------------------------------------------
    */
    // console.error("[email-parser] Gemini API call failed:", err);

    logger.error("Gemini email classification failed", {
      error: err,
    });

    return {
      is_job_application: false,
      company: null,
      role: null,
      confidence: "low",
    };
  }
}

/*
|--------------------------------------------------------------------------
| parseGeminiResponse
|--------------------------------------------------------------------------
|
| Converts Gemini's raw text into a structured object.
|
| Gemini is instructed to return JSON, but AI models sometimes return:
|
| • Markdown
| • Code blocks
| • Invalid JSON
|
| This helper cleans the response and safely parses it.
|
| It also contains an extra safety net:
|
| If Gemini incorrectly says an email is NOT a job application,
| we perform our own checks using the subject and sender.
|
|--------------------------------------------------------------------------
*/

/**
 * Parses Gemini's response into a ParsedEmail object.
 *
 * @param rawText Raw response from Gemini.
 * @param email Original email used for heuristic fallback.
 */
function parseGeminiResponse(
  rawText: string,
  email: EmailMetadata
): ParsedEmail {

  /*
  |--------------------------------------------------------------------------
  | Remove Markdown formatting
  |--------------------------------------------------------------------------
  |
  | Gemini sometimes wraps JSON inside:
  |
  | ```json
  | { ... }
  | ```
  |
  | We remove those markers first.
  |
  |--------------------------------------------------------------------------
  */
  const cleaned = rawText
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  let parsed: Record<string, unknown> | null = null;

  /*
  |--------------------------------------------------------------------------
  | Try parsing the JSON
  |--------------------------------------------------------------------------
  */
  try {
    parsed = JSON.parse(cleaned);
  } 
  catch {
    // console.error(
    //   "[email-parser] Could not parse Gemini response as JSON:",
    //   rawText
    // );

    logger.error("Failed to parse Gemini response as JSON", {
      rawResponse: rawText,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Gemini returned valid JSON
  |--------------------------------------------------------------------------
  */
  if (
    parsed &&
    typeof parsed.is_job_application === "boolean"
  ) {

    const result: ParsedEmail = {
      is_job_application: parsed.is_job_application as boolean,
      company:
        typeof parsed.company === "string"
          ? parsed.company
          : null,
      role:
        typeof parsed.role === "string"
          ? parsed.role
          : null,
      confidence: validateConfidence(parsed.confidence),
    };

    /*
    |--------------------------------------------------------------------------
    | Safety override
    |--------------------------------------------------------------------------
    |
    | Sometimes Gemini is overly cautious.
    |
    | If Gemini says:
    |
    |   "Not a job application"
    |
    | but our own subject/sender rules strongly suggest that it IS,
    | we trust the heuristic instead.
    |
    |--------------------------------------------------------------------------
    */
    if (
      !result.is_job_application &&
      isObviousConfirmation(email)
    ) {

      // console.log(
      //   "[email-parser] Heuristic override: Gemini returned false but subject/sender matched known confirmation patterns.",
      //   {
      //     subject: email.subject,
      //     from: email.from,
      //   }
      // );

      logger.info("Email classification overridden by heuristic", {
        subject: email.subject,
        from: email.from,
      });

      return {
        ...result,
        is_job_application: true,
        confidence: "medium",
      };
    }

    return result;
  }

  /*
  |--------------------------------------------------------------------------
  | Gemini response could not be parsed
  |--------------------------------------------------------------------------
  |
  | Instead of giving up completely,
  | use simple subject/sender matching.
  |
  |--------------------------------------------------------------------------
  */
  // console.warn(
  //   "[email-parser] Gemini returned unparseable response, using heuristic fallback"
  // );

  logger.warn("Gemini returned unparseable response, using heuristic fallback");

  if (isObviousConfirmation(email)) {
    return {
      is_job_application: true,
      company: extractCompanyFromSender(email.from),
      role: null,
      confidence: "medium",
    };
  }

  return {
    is_job_application: false,
    company: null,
    role: null,
    confidence: "low",
  };
}

/*
|--------------------------------------------------------------------------
| Known Applicant Tracking System (ATS) domains
|--------------------------------------------------------------------------
|
| These companies provide recruiting software.
|
| Emails from these domains are very likely to be related to
| job applications.
|
|--------------------------------------------------------------------------
*/
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
  "recruiting.ultipro.com",
  "hire.com",
  "paylocity.com",
  "paycom.com",
  "breezy.hr",
  "recruitee.com",
  "workable.com",
  "jazz.co",
  "pinpointhq.com",
  "teamtailor.com",
]);

/*
|--------------------------------------------------------------------------
| Subject line patterns
|--------------------------------------------------------------------------
|
| These are phrases commonly found in real application confirmations.
|
|--------------------------------------------------------------------------
*/
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

/**
 * Checks whether an email is obviously a job application
 * using simple rules instead of AI.
 *
 * Used as a safety net if Gemini makes a mistake.
 */
function isObviousConfirmation(email: EmailMetadata): boolean {

  /*
  |--------------------------------------------------------------------------
  | Step 1: Check the subject line
  |--------------------------------------------------------------------------
  */
  const subjectMatches =
    CONFIRMATION_SUBJECT_PATTERNS.some(
      (pattern) => pattern.test(email.subject)
    );

  if (subjectMatches) return true;

  /*
  |--------------------------------------------------------------------------
  | Step 2: Check sender domain
  |--------------------------------------------------------------------------
  */
  const emailMatch =
    email.from.match(/<(.+)>/) ??
    email.from.match(/(\S+@\S+)/);

  if (emailMatch) {

    const senderEmail =
      emailMatch[1] ?? emailMatch[0];

    const senderDomain =
      senderEmail.split("@")[1]?.toLowerCase() ?? "";

    // Exact match
    if (ATS_SENDER_DOMAINS.has(senderDomain)) {
      return true;
    }

    // Subdomain match
    for (const atsDomain of ATS_SENDER_DOMAINS) {
      if (
        senderDomain.endsWith(`.${atsDomain}`) ||
        senderDomain === atsDomain
      ) {
        return true;
      }
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| ATS domains that should not become company names
|--------------------------------------------------------------------------
|
| Example:
|
| no-reply@greenhouse-mail.io
|
| Company should NOT become:
| Greenhouse
|
|--------------------------------------------------------------------------
*/
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

/**
 * Attempts to determine the company name from the sender.
 *
 * Used when Gemini couldn't identify the company.
 */
export function extractCompanyFromSender(from: string): string {

  const emailMatch =
    from.match(/<(.+)>/) ??
    from.match(/(\S+@\S+)/);

  if (!emailMatch) {
    return "Unknown Company";
  }

  const emailAddress =
    emailMatch[1] ?? emailMatch[0];

  const domain =
    emailAddress.split("@")[1]?.toLowerCase() ?? "";

  /*
  |--------------------------------------------------------------------------
  | ATS email?
  |--------------------------------------------------------------------------
  |
  | Try using the sender's display name instead.
  |
  |--------------------------------------------------------------------------
  */
  if (ATS_DOMAINS_TO_SKIP.has(domain)) {

    const displayNameMatch =
      from.match(/^([^<]+)</);

    if (displayNameMatch) {

      const displayName =
        displayNameMatch[1].trim();

      return (
        displayName
          .replace(
            /\s+(recruiting|careers|hr|hiring|team|jobs|noreply)$/i,
            ""
          )
          .trim() || "Unknown Company"
      );
    }

    return "Unknown Company";
  }

  /*
  |--------------------------------------------------------------------------
  | Extract company from domain
  |--------------------------------------------------------------------------
  |
  | careers.google.com
  |        ↓
  | Google
  |
  |--------------------------------------------------------------------------
  */
  const parts = domain.split(".");

  const companyPart =
    parts.length >= 2
      ? parts[parts.length - 2]
      : parts[0];

  return (
    companyPart.charAt(0).toUpperCase() +
    companyPart.slice(1)
  );
}

/*
|--------------------------------------------------------------------------
| validateConfidence
|--------------------------------------------------------------------------
|
| Makes sure confidence is one of the three valid values.
|
| If Gemini returns anything unexpected,
| default to "low".
|
|--------------------------------------------------------------------------
*/

/**
 * Validates Gemini's confidence level.
 */
function validateConfidence(
  raw: unknown
): "high" | "medium" | "low" {

  if (
    raw === "high" ||
    raw === "medium" ||
    raw === "low"
  ) {
    return raw;
  }

  return "low";
}

/*
|--------------------------------------------------------------------------
| classifyEmailBatch
|--------------------------------------------------------------------------
|
| Classifies many emails one after another.
|
| A short pause is added between requests to reduce the chance of
| hitting Gemini's rate limits.
|
|--------------------------------------------------------------------------
*/

/**
 * Classifies multiple emails.
 *
 * @param emails Emails to classify.
 * @returns Classification result for every email.
 */
export async function classifyEmailBatch(
  emails: EmailMetadata[]
): Promise<Array<{ email: EmailMetadata; result: ParsedEmail }>> {

  const results: Array<{
    email: EmailMetadata;
    result: ParsedEmail;
  }> = [];

  // Process emails one at a time
  for (const email of emails) {

    const result = await classifyEmail(email);

    results.push({
      email,
      result,
    });

    /*
    |--------------------------------------------------------------------------
    | Small delay
    |--------------------------------------------------------------------------
    |
    | Helps avoid hitting Gemini's request limits.
    |
    |--------------------------------------------------------------------------
    */
    await new Promise((r) => setTimeout(r, 150));
  }

  return results;
}