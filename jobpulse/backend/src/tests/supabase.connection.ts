/*
simple supabase connectivity test

what it does:
  - verifies env is loaded
  - attempts a real query
  - confirms database is reachable
  - prints clear success/failure output
*/

import { db } from "../db/client";
import { logger } from "../core/logger";


async function testSupabaseConnection() {
  // console.log("[test] checking supabase connection...");
  logger.info("Checking Supabase connection");

  try {
    // lightweight query — does not depend on real data existing
    const { data, error } = await db
      .from("users")
      .select("id")
      .limit(1);

    if (error) {
      // console.error("[test] supabase query failed:");
      // console.error(error.message);
      logger.error("Supabase query failed", {
        error: error.message,
      });
      process.exit(1);
    }

    logger.info("Supabase connection successful ✅");

    if (data && data.length > 0) {
      // console.log("[test] sample row found:", data[0]);
      logger.info("Supabase sample row retrieved", {
        row: data[0],
      });
    } else {
      // console.log("[test] no rows found (this is fine)");
      logger.info("Supabase table contains no rows found");
    }

    process.exit(0);

  } catch (err) {
    // console.error("[test] unexpected error:");
    // console.error(err);
    logger.error("Unexpected Supabase connectivity test error", {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    process.exit(1);
  }
}

// run immediately
testSupabaseConnection();