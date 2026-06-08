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
async function testSupabaseConnection() {
    console.log("[test] checking supabase connection...");
    try {
        // lightweight query — does not depend on real data existing
        const { data, error } = await client_1.db
            .from("users")
            .select("id")
            .limit(1);
        if (error) {
            console.error("[test] supabase query failed:");
            console.error(error.message);
            process.exit(1);
        }
        console.log("[test] supabase connection successful ✅");
        if (data && data.length > 0) {
            console.log("[test] sample row found:", data[0]);
        }
        else {
            console.log("[test] no rows found (this is fine)");
        }
        process.exit(0);
    }
    catch (err) {
        console.error("[test] unexpected error:");
        console.error(err);
        process.exit(1);
    }
}
// run immediately
testSupabaseConnection();
