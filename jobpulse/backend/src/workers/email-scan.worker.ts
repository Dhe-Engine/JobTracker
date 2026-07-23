// backend/src/workers/email-scan.worker.ts

/*
what this worker does:
    - listens to the BullMQ email-scan queue
    - for each job: fetches new Gmail emails, classifies them with Gemini,
      saves confirmed job applications to the database
    - on Gemini failure: quarantines the email for retry before end of day
      instead of silently discarding it
    - deduplication check prevents the same email being saved twice
*/

import { Worker, Queue } from "bullmq";
import { config } from "../core/config";
import { db } from "../db/client";
import { getNewEmails, fetchEmailFull } from "../services/gmail.service";
import {
  classifyEmail,
  GeminiUnavailableError,
  extractCompanyFromSender,
} from "../services/email-parser.service";
import { quarantineEmail } from "../services/quarantine.service";
import { getGmailClientForUser } from "../services/auth.service";
import { google } from "googleapis";


// ─────────────────────────────────────────────────────────────────────────────
// QUEUE DEFINITION
//
// The queue is the "inbox" where scan jobs wait to be processed.
// The webhook route adds jobs here; this worker consumes them.
// Both connect to the same Redis instance via the queue name.
// ─────────────────────────────────────────────────────────────────────────────

export const emailScanQueue = new Queue("email-scan", {
  connection: { url: config.redis.url },
  defaultJobOptions: {
    // Retry up to 3 times if the job itself throws an unhandled error.
    // This is for infrastructure failures (Redis down, DB down),
    // NOT for Gemini failures — those are handled by the quarantine system.
    attempts: 3,
    backoff: {
      type:  "exponential",
      delay: 2000, // 2s, 4s, 8s
    },
    // Keep completed jobs for 24 hours for debugging
    removeOnComplete: { age: 86400 },
    // Keep failed jobs for 7 days so we can investigate
    removeOnFail: { age: 604800 },
  },
});


// ─────────────────────────────────────────────────────────────────────────────
// THE WORKER
//
// Processes one job at a time per concurrency slot.
// Each job contains: { userId: string, historyId: string }
//
// The full pipeline for each job:
//   1. Fetch new Gmail email IDs since the last historyId
//   2. For each email ID:
//      a. Check for duplicates (dedup)
//      b. Fetch the full email with body
//      c. Classify with Gemini
//         → success + true  → save to applications table
//         → success + false → discard (not a job email)
//         → Gemini error    → quarantine for retry before end of day
// ─────────────────────────────────────────────────────────────────────────────

export const emailScanWorker = new Worker(
  "email-scan",
  async (job) => {
    const { userId, historyId } = job.data as {
      userId:    string;
      historyId: string;
    };

    console.log(`[email-scan] processing job ${job.id} for user ${userId}`);

    // ── Get Gmail client once and reuse for all fetches in this job ──────────
    const { client } = await getGmailClientForUser(userId);
    const gmail = google.gmail({ version: "v1", auth: client as any });

    // ── Get user timezone for quarantine expiry calculation ──────────────────
    // Quarantine emails expire at 23:59:59 in the user's local timezone
    const { data: userRow } = await db
      .from("users")
      .select("timezone")
      .eq("id", userId)
      .single();

    const userTimezone = userRow?.timezone ?? "UTC";

    // ── Step 1: Fetch new email IDs since the last bookmark ──────────────────
    // getNewEmails() uses the stored gmail_history_id to find only
    // emails that arrived after the last scan
    const newEmails = await getNewEmails(userId, historyId);

    if (newEmails.length === 0) {
      console.log(`[email-scan] no new emails for user ${userId}`);
      return;
    }

    console.log(
      `[email-scan] found ${newEmails.length} new email(s) for user ${userId}`
    );

    // ── Step 2: Process each email ───────────────────────────────────────────
    for (const emailMeta of newEmails) {

      // ── Step 2a: Deduplication check ──────────────────────────────────────
      // Check before any expensive API calls.
      // The same Gmail message ID should never produce two application rows.
      console.log(
        `[email-scan] checking dedup for messageId: ${emailMeta.gmail_message_id}`
      );

      const { count: dedupCount, error: dedupError } = await db
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("email_id", emailMeta.gmail_message_id);

      console.log(`[email-scan] dedup result:`, {
        messageId:      emailMeta.gmail_message_id,
        duplicateCount: dedupCount,
        error:          dedupError?.message ?? null,
      });

      if (dedupCount && dedupCount > 0) {
        console.log(
          `[email-scan] skipping duplicate messageId: ${emailMeta.gmail_message_id}`
        );
        continue;
      }

      // ── Step 2b: Fetch the full email with body ────────────────────────────
      // getNewEmails() returns lightweight metadata only.
      // We need the body for accurate Gemini classification.
      const fullEmail = await fetchEmailFull(gmail, emailMeta.gmail_message_id);

      if (!fullEmail) {
        console.warn(
          `[email-scan] could not fetch full email ${emailMeta.gmail_message_id} — skipping`
        );
        continue;
      }

      // ── Step 2c: Classify with Gemini ──────────────────────────────────────
      let classification;

      try {
        classification = await classifyEmail(fullEmail);

      } catch (err) {

        if (err instanceof GeminiUnavailableError) {
          // ── QUARANTINE PATH ────────────────────────────────────────────────
          // Gemini was unavailable — this is NOT a classification decision.
          // We do not know yet whether this is a job email or not.
          // Move it to the quarantine holding room for retry before 11:59pm.
          console.log(
            `[email-scan] Gemini unavailable for "${fullEmail.subject}" — ` +
            `quarantining for retry before end of day`,
            { reason: err.reason, userId, timezone: userTimezone }
          );

          await quarantineEmail(userId, fullEmail, err.reason, userTimezone);

          // Continue to the next email — don't stop the whole job
          continue;
        }

        // Unexpected non-Gemini error — log and skip this email
        console.error(
          `[email-scan] Unexpected error classifying "${fullEmail.subject}":`,
          err
        );
        continue;
      }

      // ── Step 2d: Handle classification result ──────────────────────────────
      console.log(
        `[email-scan] Email "${fullEmail.subject}"` +
        ` → is_job_application: ${classification.is_job_application}` +
        `, confidence: ${classification.confidence}`
      );

      // Not a job application — discard
      if (!classification.is_job_application) {
        console.log(
          `[email-scan] not a job application — skipping "${fullEmail.subject}"`
        );
        continue;
      }

      // Low confidence — skip to avoid false positives in the applications list
      // The heuristic fallback in the parser already catches obvious cases,
      // so anything still at low confidence after that is genuinely uncertain
      if (classification.confidence === "low") {
        console.log(
          `[email-scan] low confidence for "${fullEmail.subject}" — skipping`
        );
        continue;
      }

      // ── Step 2e: Save the application to the database ──────────────────────
      const company =
        classification.company ?? extractCompanyFromSender(fullEmail.from);

      const { data: newApp, error: insertError } = await db
        .from("applications")
        .insert({
          user_id:    userId,
          company,
          role:       classification.role ?? "Unknown Role",
          status:     "applied",
          source:     "email_auto",
          email_id:   fullEmail.gmail_message_id,
          applied_at: fullEmail.received_at,
        })
        .select("id")
        .single();

      if (insertError) {
        // Code 23505 = unique constraint violation.
        // This means the database-level dedup caught a duplicate
        // that our query check missed — this is fine, the constraint did its job.
        if (insertError.code === "23505") {
          console.log(
            `[email-scan] DB unique constraint prevented duplicate for ` +
            `messageId: ${fullEmail.gmail_message_id}`
          );
        } else {
          console.error(
            `[email-scan] failed to insert application:`,
            insertError.message
          );
        }
      } else {
        console.log(
          `[email-scan] ✅ saved application: ` +
          `${company} — ${classification.role ?? "Unknown Role"}`
        );
      }
    }
  },

  // Worker configuration
  {
    connection:  { url: config.redis.url },
    // Process up to 5 jobs simultaneously across all users.
    // Each job itself processes emails sequentially.
    concurrency: 5,
  }
);


// ─────────────────────────────────────────────────────────────────────────────
// WORKER EVENT LISTENERS
// These appear in Railway logs so you can monitor the queue health.
// ─────────────────────────────────────────────────────────────────────────────

emailScanWorker.on("completed", (job) => {
  console.log(`[email-scan] job ${job.id} completed`);
});

emailScanWorker.on("failed", (job, err) => {
  console.error(`[email-scan] job ${job?.id} failed after all retries:`, err.message);
});