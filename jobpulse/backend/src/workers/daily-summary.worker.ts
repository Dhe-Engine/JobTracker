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



//processes a user's daily summary
async function processUserDailySummary(
    userId:string,
    timezone: string
): Promise<void> {

    const summaryDate = getYesterdayInTimeZone(timezone);

    //prevent duplicate summaries
    const {count: existingCount } = await db
        .from("daily_summaries")
        .select("id", {count: "exact", head: true})
        .eq("user_id", userId)
        .eq("date", summaryDate);
    
    if (existingCount && existingCount > 0) {
        return;
    }

    //count applications
    const {count: appliedCount} = await db
        .from("applications")
        .select("id", {count: "exact", head: true})
        .eq("user_id", userId)
        .gte("applied_at", `${summaryDate}T00:00:00+00:00`)
        .lte("applied_at", `${summaryDate}T23:59:59+00:00`);

    const todayApplied = appliedCount ?? 0;

    //compute effective target
    const goalSummary = await computeEffectiveTarget(userId);

    const effectiveTarget = goalSummary?.effective_target ?? 0;
    const metTarget = effectiveTarget > 0 && todayApplied >= effectiveTarget;

    //compute streak
    const {streakDay, longestStreak} = await computeStreak(
        userId,
        metTarget,
        timezone
    );

    //compute carryover
    let carryoverToNext = 0;

    if(!metTarget && effectiveTarget > 0) {

        const missed = effectiveTarget - todayApplied;
        const baseTarget = goalSummary?.base_target ?? effectiveTarget;
        const maxCarryover = baseTarget * config.rules.carryoverCapMultiplier;

        carryoverToNext = Math.min(Math.max(0,missed), maxCarryover);
    } 

    //build summary payload
    const summaryInput: DailySummaryInput = {

        userId,
        date: summaryDate,
        appliedCount: todayApplied,
        target: effectiveTarget,
        metTarget,
        streakDay,
        carryoverToNext,
    };

    //save summary
    const {error: insertError} = await db.from("daily_summaries").insert({
        user_id:summaryInput.userId,
        date: summaryInput.date,
        applied_count: summaryInput.appliedCount,
        target: summaryInput.target,
        met_target:summaryInput.metTarget,
        streak_day: summaryInput.streakDay,
        carryover_to_next: summaryInput.carryoverToNext,
    });

    if(insertError){
        throw new Error(insertError.message);
    }

    //update streak record
    await updateStreakRecord(userId, streakDay, longestStreak, metTarget);

    //apply carryover for tomorrow
    await applyCarryover(userId, todayApplied, effectiveTarget);

    //set shame screen flag
    if(!metTarget && effectiveTarget > 0){
        await db
            .from("streaks")
            .update({shame_screen_pending: true})
            .eq("user_id", userId);
    }
}