"use strict";
//this file is responsible for the dashboard response payload
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardPayload = getDashboardPayload;
const client_1 = require("../db/client");
const goal_services_1 = require("./goal.services");
const timezone_1 = require("../utils/timezone");
//retrieves dashboard data for a user
async function getDashboardPayload(userId) {
    //retrieve user timezone
    const { data: user } = await client_1.db
        .from("users")
        .select("timezone")
        .eq("id", userId)
        .single();
    //use utc if timezone not detected
    const timezone = user?.timezone ?? "UTC";
    //set today to user's timezone
    const today = (0, timezone_1.getTodayinTimeZone)(timezone);
    //run queries in parallel
    const [goalSummary, streakRecord, recentAppsRaw] = await Promise.all([
        (0, goal_services_1.computeEffectiveTarget)(userId),
        client_1.db
            .from("streaks")
            .select("current_streak, longest_streak, shame_screen_pending")
            .eq("user_id", userId)
            .single()
            .then((res) => res.data),
        client_1.db
            .from("applications")
            .select("id, company, role, status, applied_at")
            .eq("user_id", userId)
            .order("applied_at", { ascending: false })
            .limit(5)
            .then((res) => res.data ?? []),
    ]);
    //normalize nulls to string
    const recentApps = recentAppsRaw.map((app) => ({
        id: app.id,
        company: app.company ?? "",
        role: app.role ?? "",
        status: app.status ?? "unknown",
        applied_at: app.applied_at,
    }));
    //calculate the number of applications done in current day
    const appliedToday = await (0, goal_services_1.getTodayProgress)(userId);
    //build current day 
    const effectiveTarget = goalSummary?.effective_target ?? 0;
    const baseTarget = goalSummary?.base_target ?? 0;
    const carryover = goalSummary?.carryover ?? 0;
    const progressPct = effectiveTarget > 0 ?
        Math.min(100, Math.round((appliedToday / effectiveTarget) * 100)) : 0;
    const remaining = Math.max(0, effectiveTarget - appliedToday);
    //build streak
    const streak = {
        current: streakRecord?.current_streak ?? 0,
        longest: streakRecord?.longest_streak ?? 0,
        shame_screen_pending: streakRecord?.shame_screen_pending ?? false,
    };
    return {
        today: {
            applied_count: appliedToday,
            effective_target: effectiveTarget,
            base_target: baseTarget,
            carryover,
            progress_pct: progressPct,
            remaining,
        },
        streak,
        recent_applications: recentApps,
        goal_set: goalSummary !== null,
    };
}
