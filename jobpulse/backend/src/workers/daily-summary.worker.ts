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

