// backend/src/workers/quarantine-retry.worker.ts

/*
what this worker does:
    - retries emails that were placed in quarantine
    - saves successfully classified job applications
    - marks emails as resolved or pending based on the retry result
    - expires emails whose retry window has ended
    - runs automatically every 30 minutes
*/

import cron from "node-cron";
import { db } from "../db/client";
import {
  getPendingQuarantineEmails,
  markAsProcessing,
  markAsResolved,
  markAsFailedRetry,
  expireOverdueEmails,
} from "../services/quarantine.service";
import {
  classifyEmail,
  extractCompanyFromSender,
} from "../services/email-parser.service";
import type { EmailMetadata } from "../models/application.model";

// Cron schedule that runs every 30 minutes
const RETRY_CRON_SCHEDULE = "*/30 * * * *";

export function startQuarantineRetryCron(): void {
  cron.schedule(RETRY_CRON_SCHEDULE, async () => {
    try {
      await runRetryCycle();
    } catch (err) {
      console.error("[quarantine-retry] Cron run failed:", err);
    }
  });

  console.log(
    "[quarantine-retry] Cron started — retrying quarantined emails every 30 minutes"
  );
}


// Retry every pending quarantined email
async function runRetryCycle(): Promise<void> {
  // Expire emails whose retry window has already closed
  await expireOverdueEmails();

  // Get emails waiting to be retried
  const pendingEmails = await getPendingQuarantineEmails();

  // Nothing to retry
  if (pendingEmails.length === 0) {
    return;
  }

  console.log(
    `[quarantine-retry] Starting retry cycle — ${pendingEmails.length} email(s) pending`
  );

  let resolved = 0;
  let failed = 0;

  for (const row of pendingEmails) {

    // Lock the email so only one worker processes it
    const locked = await markAsProcessing(row.id);

    if (!locked) {
      continue;
    }

    // Rebuild the email object expected by the classifier
    const email: EmailMetadata = {
      gmail_message_id: row.gmail_message_id,
      subject: row.subject,
      from: row.sender,
      received_at: row.received_at,
      body: row.body ?? "",
    };

    console.log("[quarantine-retry] Retrying email:", {
      quarantineId: row.id,
      subject: row.subject,
      retryCount: row.retry_count,
      expiresAt: row.expires_at,
    });

    try {
      // Try classifying the email again
      const classification = await classifyEmail(email);

      // Retry succeeded but it's not a job application
      if (
        !classification.is_job_application ||
        classification.confidence === "low"
      ) {
        await markAsResolved(row.id, "not_a_job_email");

        console.log(
          `[quarantine-retry] Resolved as NOT a job email: "${row.subject}"`
        );

        resolved++;
        continue;
      }

      // Determine the company name
      const company =
        classification.company ?? extractCompanyFromSender(row.sender);

      // Skip if the application was already saved
      const { count } = await db
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", row.user_id)
        .eq("email_id", row.gmail_message_id);

      if (count && count > 0) {
        await markAsResolved(row.id, "saved_as_application");

        console.log(
          `[quarantine-retry] Email already exists — marking resolved: "${row.subject}"`
        );

        resolved++;
        continue;
      }

      // Save the recovered application
      const { data: newApp, error: insertError } = await db
        .from("applications")
        .insert({
          user_id: row.user_id,
          company,
          role: classification.role ?? "Unknown Role",
          status: "applied",
          source: "email_auto",
          email_id: row.gmail_message_id,
          applied_at: row.received_at,
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(`DB insert failed: ${insertError.message}`);
      }

      await markAsResolved(
        row.id,
        "saved_as_application",
        newApp?.id
      );

      console.log(
        `[quarantine-retry] ✅ Saved application: ${company} — ${classification.role ?? "Unknown Role"}`
      );

      resolved++;

    } catch (retryErr: any) {
      failed++;

      // Check whether Gemini is still unavailable
      const isStillGeminiError =
        retryErr?.message?.includes("503") ||
        retryErr?.message?.includes("Service Unavailable") ||
        retryErr?.message?.includes("high demand") ||
        retryErr?.message?.includes("GoogleGenerativeAI");

      console.warn(
        `[quarantine-retry] Retry failed for "${row.subject}":`,
        {
          quarantineId: row.id,
          retryCount: row.retry_count,
          reason: isStillGeminiError
            ? "gemini_still_unavailable"
            : retryErr?.message,
        }
      );

      // Return the email to the pending queue for the next retry
      await markAsFailedRetry(row.id, row.retry_count);
    }

    // Small delay to avoid sending too many Gemini requests at once
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `[quarantine-retry] Cycle complete — resolved: ${resolved}, still pending: ${failed}`
  );
}