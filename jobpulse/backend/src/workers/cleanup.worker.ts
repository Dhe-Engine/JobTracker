// backend/src/workers/cleanup.worker.ts

// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS WORKER DOES
// Runs scheduled cleanup tasks to remove old data that is no longer needed.
// This keeps the database and queue clean, improves performance,
// and prevents unnecessary storage growth.
// ─────────────────────────────────────────────────────────────────────────────

import cron from "node-cron";
import { db } from "../db/client";
import { logger } from "../core/logger";

// Run every Sunday at 2am UTC
const CLEANUP_CRON = "0 2 * * 0";

// Keep notification logs for 30 days
const NOTIFICATION_LOG_RETENTION_DAYS = 30;

// Remove FCM tokens that have not been used for 90 days
const FCM_TOKEN_STALE_DAYS = 90;

export function startCleanupCron(): void {
  // Start the weekly cleanup schedule
  cron.schedule(CLEANUP_CRON, async () => {
    try {
      await runCleanup();
    } catch (err) {
      logger.error("Cleanup cron failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info("Cleanup cron started", { schedule: CLEANUP_CRON });
}

async function runCleanup(): Promise<void> {
  logger.info("Starting weekly cleanup");

  // Run all cleanup tasks in parallel
  const results = await Promise.allSettled([
    cleanNotificationLogs(),
    cleanStaleFcmTokens(),
    cleanFailedBullMQJobs(),
  ]);

  // Log any task that failed without stopping the others
  results.forEach((result, i) => {
    const name = ["notification_logs", "fcm_tokens", "bullmq_jobs"][i];
    if (result.status === "rejected") {
      logger.warn(`Cleanup task failed: ${name}`, {
        error: result.reason?.message ?? String(result.reason),
      });
    }
  });

  logger.info("Weekly cleanup complete");
}

async function cleanNotificationLogs(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NOTIFICATION_LOG_RETENTION_DAYS);

  // Delete old notification logs in batches
  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    // Find up to 1000 old log records
    const { data: oldRows } = await db
      .from("notifications_log")
      .select("id")
      .lt("sent_at", cutoff.toISOString())
      .limit(1000);

    if (!oldRows || oldRows.length === 0) break;

    const ids = oldRows.map((r) => r.id);

    // Delete the selected records
    const { error, count } = await db
      .from("notifications_log")
      .delete()
      .in("id", ids);

    if (error) throw new Error(error.message);

    batchDeleted = count ?? 0;
    totalDeleted += batchDeleted;

    // Small delay before processing the next batch
    if (batchDeleted > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }

  } while (batchDeleted === 1000);

  logger.info("Notification logs cleaned", {
    deleted:       totalDeleted,
    retentionDays: NOTIFICATION_LOG_RETENTION_DAYS,
    cutoffDate:    cutoff.toISOString().split("T")[0],
  });
}

async function cleanStaleFcmTokens(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FCM_TOKEN_STALE_DAYS);

  // Remove FCM tokens that have not been used recently
  const { error, count } = await db
    .from("fcm_tokens")
    .delete()
    .lt("last_seen", cutoff.toISOString());

  if (error) throw new Error(error.message);

  logger.info("Stale FCM tokens cleaned", {
    deleted:    count ?? 0,
    staleDays:  FCM_TOKEN_STALE_DAYS,
    cutoffDate: cutoff.toISOString().split("T")[0],
  });
}

async function cleanFailedBullMQJobs(): Promise<void> {
  // Import here to avoid a circular dependency
  const { emailScanQueue } = await import("./email-scan.worker");

  // Remove failed jobs older than 7 days
  const removed = await emailScanQueue.clean(
    7 * 24 * 60 * 60 * 1000,
    100,
    "failed"
  );

  logger.info("BullMQ failed jobs cleaned", { removed: removed.length });
}