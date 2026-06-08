"use strict";
/*
this file is responsible for preparing user activity data

what it does:
  - aggregates daily summaries into weekly and monthly views
  - fills missing days for heatmap continuity
  - computes totals, streaks, and performance insights
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWeeklyHistory = getWeeklyHistory;
exports.getMonthlyHistory = getMonthlyHistory;
const client_1 = require("../db/client");
//maps the applied target to heatmap intensity
function computeIntensity(appliedCount, target) {
    if (target === 0 || appliedCount === 0)
        return 0;
    ;
    const ratio = appliedCount / target;
    if (ratio >= 1)
        return 4;
    if (ratio >= 0.5)
        return 3;
    if (ratio >= 0.25)
        return 2;
    return 1;
}
//generate a list of past days based on the number specified and format to 'yyyy-mm-dd'
function buildDateRange(timezone, days) {
    const dates = [];
    const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(formatter.format(d));
    }
    return dates;
}
/*
merge db summaries with full date range

a day with no data should be filled with zero
to prevent empty gaps in heatmap
*/
function mergeSummariesWithDateRange(dateRange, summaries) {
    const summaryMap = new Map(summaries.map((s) => [s.date, s]));
    return dateRange.map((date) => {
        const summary = summaryMap.get(date);
        if (!summary) {
            return {
                date,
                applied_count: 0,
                target: 0,
                met_target: false,
                streak_day: 0,
                intensity: 0,
            };
        }
        return {
            date: summary.date,
            applied_count: summary.applied_count,
            target: summary.target,
            met_target: summary.met_target,
            streak_day: summary.streak_day,
            intensity: computeIntensity(summary.applied_count, summary.target),
        };
    });
}
//returns last 7 days activity and summary
async function getWeeklyHistory(userId) {
    const { data: user } = await client_1.db
        .from("users")
        .select("timezone")
        .eq("id", userId)
        .single();
    const timezone = user?.timezone ?? "UTC";
    const dateRange = buildDateRange(timezone, 7);
    const { data: summaries, error } = await client_1.db
        .from("daily_summaries")
        .select("date, applied_count, target, met_target, streak_day")
        .eq("user_id", userId)
        .gte("date", dateRange[0])
        .lte("date", dateRange[6])
        .order("date", { ascending: true });
    if (error) {
        throw new Error(`Failed to fetch summaries: ${error.message}`);
    }
    const normalizedSummaries = (summaries ?? []).map((s) => ({
        ...s,
        streak_day: s.streak_day ?? 0
    }));
    const days = mergeSummariesWithDateRange(dateRange, normalizedSummaries);
    const total_applied = days.reduce((sum, d) => sum + d.applied_count, 0);
    const days_met_target = days.filter((d) => d.met_target).length;
    const best_day = days.reduce((best, d) => {
        return !best || d.applied_count > best.applied_count ? d : best;
    }, null);
    return { days, total_applied, days_met_target, best_day };
}
//returns last 30days, streak and best 7 day streak
async function getMonthlyHistory(userId) {
    const { data: user } = await client_1.db
        .from("users")
        .select("timezone")
        .eq("id", userId)
        .single();
    const timezone = user?.timezone ?? "UTC";
    const dateRange = buildDateRange(timezone, 30);
    const [summariesResult, streakResult] = await Promise.all([
        client_1.db
            .from("daily_summaries")
            .select("date, applied_count, target, met_target, streak_day")
            .eq("user_id", userId)
            .gte("date", dateRange[0])
            .lte("date", dateRange[29])
            .order("date", { ascending: true }),
        client_1.db
            .from("streaks")
            .select("current_streak, longest_streak")
            .eq("user_id", userId)
            .single(),
    ]);
    const normalizedSummaries = (summariesResult.data ?? []).map((s) => ({
        ...s,
        streak_day: s.streak_day ?? 0,
    }));
    const days = mergeSummariesWithDateRange(dateRange, normalizedSummaries);
    const total_applied = days.reduce((sum, d) => sum + d.applied_count, 0);
    const days_met_target = days.filter((d) => d.met_target).length;
    //check for the best 7 days
    let best_week_total = 0;
    for (let i = 0; i <= days.length - 7; i++) {
        const weekTotal = days
            .slice(i, i + 7)
            .reduce((sum, d) => sum + d.applied_count, 0);
        if (weekTotal > best_week_total)
            best_week_total = weekTotal;
    }
    return {
        days,
        total_applied,
        days_met_target,
        current_streak: streakResult.data?.current_streak ?? 0,
        longest_streak: streakResult.data?.longest_streak ?? 0,
        best_week_total,
    };
}
