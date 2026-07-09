// backend/src/workers/gmail-watch-renewal.worker.ts

/*
what this worker does:
    - automatically renews Gmail push notification watches before they expire
    - checks for users whose Gmail watch is close to expiring
    - creates a new Gmail watch for those users
    - keeps automatic email tracking running without user intervention
*/

import cron from "node-cron";
import { db } from "../db/client";
import { setupGmailWatch } from "../services/gmail.service";
import { logger } from "../core/logger";

// Cron schedule for checking Gmail watches
// Runs every day at 3:00 AM UTC
const RENEWAL_CRON = "0 3 * * *";

// Renew watches that expire within the next 48 hours
// Gives enough time to recover if a scheduled run is missed
const RENEWAL_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export function startGmailWatchRenewalCron(): void {
  // Start the scheduled renewal job
  cron.schedule(RENEWAL_CRON, async () => {
    try {
      await renewExpiringWatches();
    } catch (err) {
      logger.error("Gmail watch renewal cron failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Record that the scheduler started successfully
  logger.info("Gmail watch renewal cron started", {
    schedule: RENEWAL_CRON,
    renewalThresholdHours: 48,
  });
}

async function renewExpiringWatches(): Promise<void> {
  // Any watch expiring before this time should be renewed
  const cutoff = Date.now() + RENEWAL_THRESHOLD_MS;

  // Find users whose Gmail watch is close to expiring
  const { data: users, error } = await db
    .from("users")
    .select("id, email, gmail_watch_expiry, gmail_token")
    .not("gmail_token", "is", null)
    .not("gmail_watch_expiry", "is", null)
    .lt("gmail_watch_expiry", cutoff.toString());

  if (error) {
    logger.error("Failed to fetch users for watch renewal", {
      error: error.message,
    });
    return;
  }

  // Nothing to renew today
  if (!users || users.length === 0) {
    logger.debug("No Gmail watches need renewal today");
    return;
  }

  logger.info("Renewing Gmail watches", {
    count: users.length,
  });

  let renewed = 0;
  let failed = 0;

  // Renew each user's Gmail watch
  for (const user of users) {
    try {
      await setupGmailWatch(user.id);

      renewed++;

      logger.info("Gmail watch renewed", {
        userId: user.id,
        email: user.email,
      });
    } catch (err) {
      failed++;

      logger.warn("Failed to renew Gmail watch for user", {
        userId: user.id,
        email: user.email,
        error: err instanceof Error ? err.message : String(err),
      });

      // Continue renewing the remaining users
    }
  }

  // Log the final renewal summary
  logger.info("Gmail watch renewal complete", {
    renewed,
    failed,
  });
}