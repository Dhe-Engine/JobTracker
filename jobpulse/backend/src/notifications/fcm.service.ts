/*
this file handles firebase cloud messaging notifications
*/


import * as admin from "firebase-admin";
import { config } from "../core/config";
import { db } from "../db/client";
import type { NotificationMessage } from "./message-composer";
import { fa } from "zod/locales";


//initialize firebase admin
if (!admin.apps.length) {

    admin.initializeApp({
        credential: admin.credential.cert(
            config.fcm.serviceAccountKey as admin.ServiceAccount
        ),
    });
}

const messaging = admin.messaging();

//sends a notification to a device token
export async function sendPushNotification(
    fcmToken:string,
    message: NotificationMessage
): Promise<{success: boolean; shouldRemoveToken: boolean}> {
    
    try{
        await messaging.send({
            token: fcmToken,

            notification: {
                title: message.title,
                body: message.body,
            },

            data: {
                type: message.data.type,
                url: message.data.url,
                sentAt: new Date().toISOString(),
            },

            webpush: {
                fcmOptions: {
                    link: message.data.url,
                },

                notification: {
                    icon: "/icons/icon-192x192.png",
                    badge: "/icons/badge-72x72.png",
                    vibrate: [200, 100, 200],
                    requireInteraction: false,
                },
            },
        });

        return {success: true, shouldRemoveToken: false};
    }
    catch (err: unknown){

        const errorCode = (err as {code?: string})?.code;

        const isInvalidToken = 
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument";

        if(isInvalidToken) {
            console.warn(`[fcm] Invalid token — will be removed: ${fcmToken.slice(0, 20)}...`);
            return {success: false, shouldRemoveToken: true};
        }

        console.error("[fcm] Send error:", errorCode, err);
        return {success: false, shouldRemoveToken: false};
    }
}

//send notification to all devices for one user
export async function sendToUser(
    userId: string,
    message: NotificationMessage
): Promise<boolean> {

    const {data: tokens} = await db
        .from("fcm_tokens")
        .select("id, token")
        .eq("user_id", userId);

    if (!tokens || tokens.length === 0) {
        console.log(`[fcm] no tokens for user ${userId}`);
        return false;
    }

    const staleTokenIds: string[] = [];
    let atLeastOneSent = false;

    for (const tokenRow of tokens){
        const result = await sendPushNotification(tokenRow.token, message);

        if(result.success) {
            atLeastOneSent = true;
        }

        if (result.shouldRemoveToken) {
            staleTokenIds.push(tokenRow.id);
        }
    }

    if(staleTokenIds.length > 0){
        await db
            .from("fcm_tokens")
            .delete()
            .in("id", staleTokenIds);

        console.log(
            `[fcm] removed ${staleTokenIds.length} stale token(s) for user ${userId}`);
    }

    return atLeastOneSent;
}

//register or update device token 
export async function registerToken(
    userId: string,
    token: string
): Promise<void> {

    const {error} = await db
        .from("fcm_tokens")
        .upsert(
            {
                user_id: userId,
                token,
                last_seen: new Date().toISOString(),
            },
            {
                onConflict: "user_id,token",
                ignoreDuplicates: false,
            }
        );

    if (error) {
        throw new Error(`failed to register fcm token: ${error.message}`);
    } 
}

//log notification sent
export async function logNotificationSent(
    userId: string,
    window_period: string,
    message: string,
): Promise<void> {

    await db.from("notifications_log").insert(
        {
            user_id: userId,
            window_period,
            message,
            sent_at: new Date().toISOString(),
            delivered: true,
        }
    );
}