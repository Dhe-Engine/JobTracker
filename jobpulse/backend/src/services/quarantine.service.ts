// backend/src/services/quarantine.service.ts

/*
what this service does:
    - stores emails that could not be classified because Gemini failed
    - retries quarantined emails before they expire
    - tracks the status of each quarantined email
    - expires emails that were not resolved before the end of the day
    - provides quarantine statistics for debugging and monitoring
*/

import { db } from "../db/client";
import type { EmailMetadata } from "../models/application.model";

// Reason why an email was placed into quarantine
export type QuarantineReason =
  | "gemini_unavailable"
  | "gemini_parse_error"
  | "unknown_error";

// Current processing status of a quarantined email
export type QuarantineStatus =
  | "pending"
  | "processing"
  | "resolved"
  | "expired";

// Final outcome after a retry finishes
export type QuarantineResolution =
  | "saved_as_application"
  | "not_a_job_email";


// Save an email into quarantine so it can be retried later
export async function quarantineEmail(
  userId: string,
  email: EmailMetadata,
  reason: QuarantineReason,
  userTimezone: string = "UTC"
): Promise<void> {
  // Expire the email at the end of the user's current day
  const expiresAt = getEndOfDayInTimezone(userTimezone);

  const { error } = await db.from("quarantine_emails").upsert(
    {
      user_id:          userId,
      gmail_message_id: email.gmail_message_id,
      subject:          email.subject,
      sender:           email.from,
      received_at:      email.received_at,
      body:             email.body ?? "",
      fail_reason:      reason,
      status:           "pending",
      retry_count:      0,
      expires_at:       expiresAt,
      updated_at:       new Date().toISOString(),
    },
    {
      // Prevent duplicate quarantine records for the same email
      onConflict: "user_id,gmail_message_id",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    // Log the failure but allow the worker to continue
    console.error("[quarantine] Failed to quarantine email:", {
      userId,
      messageId: email.gmail_message_id,
      subject: email.subject,
      error: error.message,
    });
    return;
  }

  console.log("[quarantine] Email quarantined — will retry before end of day:", {
    userId,
    messageId: email.gmail_message_id,
    subject: email.subject,
    reason,
    expiresAt,
  });
}


// Get all pending emails that are still eligible for retry
export async function getPendingQuarantineEmails() {
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("quarantine_emails")
    .select(`
      id,
      user_id,
      gmail_message_id,
      subject,
      sender,
      received_at,
      body,
      fail_reason,
      retry_count,
      expires_at
    `)
    .eq("status", "pending")
    .gt("expires_at", now)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[quarantine] Failed to fetch pending emails:", error.message);
    return [];
  }

  return data ?? [];
}


// Lock an email so only one worker retries it
export async function markAsProcessing(quarantineId: string): Promise<boolean> {
  const { error, count } = await db
    .from("quarantine_emails")
    .update({
      status: "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", quarantineId)
    .eq("status", "pending");

  // True means this worker successfully acquired the lock
  return !error && (count ?? 0) > 0;
}


// Mark a quarantined email as successfully processed
export async function markAsResolved(
  quarantineId: string,
  resolution: QuarantineResolution,
  applicationId?: string
): Promise<void> {
  await db
    .from("quarantine_emails")
    .update({
      status: "resolved",
      resolution,
      application_id: applicationId ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", quarantineId);
}


// Return a failed retry back to the pending queue
export async function markAsFailedRetry(
  quarantineId: string,
  currentRetryCount: number
): Promise<void> {
  await db
    .from("quarantine_emails")
    .update({
      status: "pending",
      retry_count: currentRetryCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quarantineId);
}


// Expire emails whose retry window has ended
export async function expireOverdueEmails(): Promise<number> {
  const now = new Date().toISOString();

  const { count, error } = await db
    .from("quarantine_emails")
    .update({
      status: "expired",
      updated_at: now,
    })
    .eq("status", "pending")
    .lt("expires_at", now);

  if (error) {
    console.error("[quarantine] Failed to expire overdue emails:", error.message);
    return 0;
  }

  const expired = count ?? 0;

  if (expired > 0) {
    console.log(`[quarantine] Marked ${expired} email(s) as expired`);
  }

  return expired;
}


// Get a summary of quarantine activity for one user
export async function getQuarantineStats(userId: string) {
  const { data, error } = await db
    .from("quarantine_emails")
    .select("status, fail_reason, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return null;

  return {
    total: data.length,
    pending: data.filter((r) => r.status === "pending").length,
    resolved: data.filter((r) => r.status === "resolved").length,
    expired: data.filter((r) => r.status === "expired").length,
    by_reason: groupBy(data, "fail_reason"),
  };
}


// Return the user's end-of-day timestamp in ISO format
function getEndOfDayInTimezone(timezone: string): string {
  const now = new Date();

  // Get today's date in the user's timezone
  const todayStr = new Intl.DateTimeFormat("sv-SE", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, day] = todayStr.split("-").map(Number);

  // Used while calculating the timezone offset
  const tomorrowLocal = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T00:00:00`
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  // Convert the user's local end-of-day into UTC
  const utcOffset = getUTCOffsetMinutes(timezone);

  const endOfDay = new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59) -
    utcOffset * 60 * 1000
  );

  return endOfDay.toISOString();
}


// Calculate the current UTC offset for a timezone
function getUTCOffsetMinutes(timezone: string): number {
  const now = new Date();

  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const localStr = now.toLocaleString("en-US", { timeZone: timezone });

  const utcDate = new Date(utcStr);
  const localDate = new Date(localStr);

  return (localDate.getTime() - utcDate.getTime()) / 60000;
}


// Count how many items belong to each value of a field
function groupBy<T extends Record<string, any>>(
  arr: T[],
  key: keyof T
): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}