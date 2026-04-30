//this file is responsible for the dashboard response payload

import { db } from "../db/client";
import { computeEffectiveTarget, getTodayProgress } from "./goal.services";
import { getTodayinTimeZone } from "../utils/timezone";

//define the shape of the api
export interface DashboardPayload{

    today:{
        applied_count: number;
        effective_target: number;
        base_target: number;
        carryover: number;
        progress_pct: number;
        remaining: number;
    };
    streak:{
        current: number;
        longest: number;
        shame_screen_pending: boolean;
    }
    recent_applications: Array<{
        id: string;
        company: string;
        role: string;
        status: string;
        applied_at: string;
    }>;
    goal_set: boolean;

}

//retrieves dashboard data for a user
export async function getDashboardPayload(
    userId: string
): Promise<DashboardPayload> {

    //retrieve user timezone
    const {data: user} = await db
        .from("users")
        .select("timezone")
        .eq("id", userId)
        .single();

    //use utc if timezone not detected
    const timezone = user?.timezone ?? "UTC";
    //set today to user's timezone
    const today = getTodayinTimeZone(timezone);

    //run queries in parallel
    const [goalSummary, streakRecord, recentAppsRaw] = await Promise.all(
        [
            computeEffectiveTarget(userId),

            db
                .from("streaks")
                .select("current_streak, longest_streak, shame_screen_pending")
                .eq("user_id", userId)
                .single()
                .then((res) => res.data),

            db
                .from("applications")
                .select("id, company, role, status, applied_at")
                .eq("user_id",userId)
                .order("applied_at", {ascending:false})
                .limit(5)
                .then((res) => res.data ?? []),
        ]
    );

    //normalize nulls to string
    const recentApps = recentAppsRaw.map((app) => ({
        id: app.id,
        company: app.company ?? "",
        role: app.role ?? "",
        status: app.status ?? "unknown",
        applied_at: app.applied_at,
    }));

    //calculate the number of applications done in current day
    const appliedToday = await getTodayProgress(userId)

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