/*
this file handles firebase cloud messaging notifications
*/


import * as admin from "firebase-admin";
import { config } from "../core/config";
import { db } from "../db/client";
import type { NotificationMessage } from "./message-composer";


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

