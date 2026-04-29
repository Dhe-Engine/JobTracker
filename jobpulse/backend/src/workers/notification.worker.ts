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

