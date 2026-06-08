"use strict";
/*
this file handle motivational push notifications

what it does:
    - run scheduled notification checks
    - compose and send notifications
    - prevent duplicate or excessive sends
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNotificationCron = startNotificationCron;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("../db/client");
const config_1 = require("../core/config");
const goal_services_1 = require("../services/goal.services");
const fcm_service_1 = require("../notifications/fcm.service");
const message_composer_1 = require("../notifications/message-composer");
const timezone_1 = require("../utils/timezone");
//start notification cron job
function startNotificationCron() {
    node_cron_1.default.schedule(config_1.config.rules.notificationCronSchedule, async () => {
        try {
            await processAllUsers();
        }
        catch (err) {
            console.error("[notifications] cron run failed:", err);
        }
    });
    console.log("[notifications] cron started - running every 15 mins");
}
//process notification for all users
async function processAllUsers() {
    const { data: users, error } = await client_1.db
        .from("users")
        .select(`
            id,
            timezone,
            notifications_enabled,
            fcm_tokens ( id )
        `)
        .eq("notifications_enabled", true)
        .not("fcm_tokens", "is", null);
    if (error || !users || users.length === 0)
        return;
    const eligbleUsers = users.filter((u) => Array.isArray(u.fcm_tokens) && u.fcm_tokens.length > 0);
    console.log(`[notifications] processing ${eligbleUsers.length} eligible user(s)`);
    const results = await Promise.allSettled(eligbleUsers.map((user) => processUserNotification(user.id, user.timezone)));
    results.forEach((result, i) => {
        if (result.status === "rejected") {
            console.error(`[notifications] failed for user ${eligbleUsers[i].id}:`, result.reason);
        }
    });
}
//process notification for one user
async function processUserNotification(userId, timezone) {
    const goalSummary = await (0, goal_services_1.computeEffectiveTarget)(userId);
    if (!goalSummary || goalSummary.effective_target === 0) {
        return;
    }
    const { effective_target } = goalSummary;
    const appliedToday = await (0, goal_services_1.getTodayProgress)(userId);
    if (appliedToday >= effective_target) {
        return;
    }
    const localHour = (0, timezone_1.getCurrentHourInTimeZone)(timezone);
    const window = (0, message_composer_1.getWindowForHour)(localHour);
    const alreadySentRecently = await checkRecentNotification(userId, window, timezone);
    if (alreadySentRecently)
        return;
    const threshold = (0, message_composer_1.getWindowThreshold)(window);
    if (threshold !== null) {
        const progressFraction = effective_target > 0 ? appliedToday / effective_target : 0;
        if (progressFraction >= threshold) {
            return;
        }
    }
    const hoursRemaining = 23 - localHour;
    const message = await (0, message_composer_1.composeNotification)({
        window,
        appliedToday,
        effectiveTarget: effective_target,
        hoursRemaining,
    });
    const sent = await (0, fcm_service_1.sendToUser)(userId, message);
    if (sent) {
        await (0, fcm_service_1.logNotificationSent)(userId, window, message.body);
        console.log(`[notifications] sent ${window} notification to user ${userId}:` +
            `"${message.title}" | ${appliedToday}/${effective_target} applied`);
    }
}
//check recent notification
async function checkRecentNotification(userId, window, timezone) {
    const frequencyMinutes = (0, message_composer_1.getWindowFrequencyMinutes)(window);
    const cutoffTime = new Date(Date.now() - frequencyMinutes * 60 * 1000).toISOString();
    const today = new Intl.DateTimeFormat("sv-SE", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    const query = client_1.db
        .from("notifications_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("window_period", window)
        .gte("sent_at", cutoffTime);
    if (window === "night") {
        query.gte("sent_at", `${today}T00:00:00+00:00`);
    }
    const { count } = await query;
    return (count ?? 0) > 0;
}
