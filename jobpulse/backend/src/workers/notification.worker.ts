/*
this file handle motivational push notifications

what it does:
    - run scheduled notification checks
    - compose and send notifications
    - prevent duplicate or excessive sends
*/

import cron from "node-cron";
import { db } from "../db/client";
import { config } from "../core/config";
import { getTodayProgress, computeEffectiveTarget } from "../services/goal.services";
import { sendToUser, logNotificationSent } from "../notifications/fcm.service";
import { 
    composeNotification, getWindowForHour, getWindowFrequencyMinutes, getWindowThreshold 
} from "../notifications/message-composer";


//start notification cron job
export function startNotificationCron(): void {

    cron.schedule(config.rules.notificationCronSchedule, async() => {
        try{
            await processAllUsers();
        }
        catch (err) {
            console.error("[notifications] cron run failed:", err);
        }
    });

    console.log("[notifications] cron started - running every 15 mins")
}


//process notification for all users
async function processAllUsers(): Promise<void> {
    const {data: users, error} = await db
        .from("users")
        .select(`
            id,
            timezone,
            notifications_enabled,
            fcm_tokens ( id )
        `)
        .eq("notifications_enabled", true)
        .not("fcm_tokens", "is", null);

    if(error || !users || users.length === 0) return;

    const eligbleUsers = users.filter(
        (u) => Array.isArray(u.fcm_tokens) && u.fcm_tokens.length > 0
    );

    console.log(`[notifications] processing ${eligbleUsers.length} eligible user(s)`);

    const results = await Promise.allSettled(
        eligbleUsers.map((user) => 
            processUserNotification(user.id, user.timezone)
        )
    );

    results.forEach((result, i) => {

        if (result.status === "rejected") {
            console.error(
                `[notifications] failed for user ${eligbleUsers[i].id}:`,
                result.reason
            );
        }
    });

    
}
