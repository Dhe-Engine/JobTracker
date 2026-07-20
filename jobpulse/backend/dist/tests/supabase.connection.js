"use strict";
/*
simple supabase connectivity test

what it does:
  - verifies env is loaded
  - attempts a real query
  - confirms database is reachable
  - prints clear success/failure output
*/
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../db/client");
const logger_1 = require("../core/logger");
async function testSupabaseConnection() {
    // console.log("[test] checking supabase connection...");
    logger_1.logger.info("Checking Supabase connection");
    try {
        // lightweight query — does not depend on real data existing
        const { data, error } = await client_1.db
            .from("users")
            .select("id")
            .limit(1);
        if (error) {
            // console.error("[test] supabase query failed:");
            // console.error(error.message);
            logger_1.logger.error("Supabase query failed", {
                error: error.message,
            });
            process.exit(1);
        }
        logger_1.logger.info("Supabase connection successful ✅");
        if (data && data.length > 0) {
            // console.log("[test] sample row found:", data[0]);
            logger_1.logger.info("Supabase sample row retrieved", {
                row: data[0],
            });
        }
        else {
            // console.log("[test] no rows found (this is fine)");
            logger_1.logger.info("Supabase table contains no rows found");
        }
        process.exit(0);
    }
    catch (err) {
        // console.error("[test] unexpected error:");
        // console.error(err);
        logger_1.logger.error("Unexpected Supabase connectivity test error", {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
        process.exit(1);
    }
}
// run immediately
testSupabaseConnection();
