/*
handles automatically daily performance summary generation

what it does:
    - runs every minute
    - checks which user just reached midnight
    - calculates daily progress and streaks
    - saves daily summary record
    - applies carryover for the next day
*/

import cron from "node-cron";
import { db } from "../db/client";
import { config } from "../core/config";
import { computeEffectiveTarget, applyCarryover } from "../services/goal.services";
import { getYesterdayInTimeZone } from "../utils/timezone";
import type { DailySummaryInput } from "../models/daily-summary.model";


/*
starts the cron job: run every minute

detect users whose local timzone is midnight
 */

export function startDailySummaryCron(): void {

    cron.schedule("* * * * *", async () => {
        try{
            await processMidnightUsers();
        }
        catch(err) {
            console.error("[daily-summary] cron job failed");
        }
    });

    console.log("[daily-summary] cron job started")
} 


/**
 * process users currently at midnight
 * 
 * what it does:
 *  - fetch all users
 *  - check their local time
 *  - process users at 00:00
 */

async function processMidnightUsers(): Promise<void> {

    const {data: users, error } = await db
        .from("users")
        .select("id, timezone, email")
        .not("timezone", "is", null);

    if (error || !users || users.length === 0) return 0;
    
    const now = new Date();

    const midnightUsers = users.filter((user) => {

        const localHour = new Intl.DateTimeFormat("en-US", {
            timeZone: user.timezone,
            hour: "numeric",
            hour12: false,
        }).format(now);

        const localMinute = new Intl.DateTimeFormat("en-US", {
            timeZone: user.timezone,
            minute: "numeric",
        }).format(now);

        const hour = parseInt(localHour) === 24 ? 0 : parseInt(localHour);
        const minute = parseInt(localMinute);

        return hour === 0 && minute === 0;
    });

    if (midnightUsers.length === 0) return;

    console.log(`[daily-summary] processing ${midnightUsers.length} user(s)`);

    for (const user of midnightUsers) {

        try{
            await processUserDailySummary(user.id, user.timezone);
        }
        catch (err) {
            console.error(`[daily-summary] failed for user ${user.id} (${user.email}):`,
                err
            );
        }
    }
}

