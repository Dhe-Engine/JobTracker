"use strict";
/*
this file handles firebase cloud messaging notifications
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = sendPushNotification;
exports.sendToUser = sendToUser;
exports.registerToken = registerToken;
exports.logNotificationSent = logNotificationSent;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../core/config");
const client_1 = require("../db/client");
//initialize firebase admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(config_1.config.fcm.serviceAccountKey),
    });
}
const messaging = admin.messaging();
//sends a notification to a device token
async function sendPushNotification(fcmToken, message) {
    try {
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
        return { success: true, shouldRemoveToken: false };
    }
    catch (err) {
        const errorCode = err?.code;
        const isInvalidToken = errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-argument";
        if (isInvalidToken) {
            console.warn(`[fcm] Invalid token — will be removed: ${fcmToken.slice(0, 20)}...`);
            return { success: false, shouldRemoveToken: true };
        }
        console.error("[fcm] Send error:", errorCode, err);
        return { success: false, shouldRemoveToken: false };
    }
}
//send notification to all devices for one user
async function sendToUser(userId, message) {
    const { data: tokens } = await client_1.db
        .from("fcm_tokens")
        .select("id, token")
        .eq("user_id", userId);
    if (!tokens || tokens.length === 0) {
        console.log(`[fcm] no tokens for user ${userId}`);
        return false;
    }
    const staleTokenIds = [];
    let atLeastOneSent = false;
    for (const tokenRow of tokens) {
        const result = await sendPushNotification(tokenRow.token, message);
        if (result.success) {
            atLeastOneSent = true;
        }
        if (result.shouldRemoveToken) {
            staleTokenIds.push(tokenRow.id);
        }
    }
    if (staleTokenIds.length > 0) {
        await client_1.db
            .from("fcm_tokens")
            .delete()
            .in("id", staleTokenIds);
        console.log(`[fcm] removed ${staleTokenIds.length} stale token(s) for user ${userId}`);
    }
    return atLeastOneSent;
}
//register or update device token 
async function registerToken(userId, token) {
    const { error } = await client_1.db
        .from("fcm_tokens")
        .upsert({
        user_id: userId,
        token,
        last_seen: new Date().toISOString(),
    }, {
        onConflict: "user_id,token",
        ignoreDuplicates: false,
    });
    if (error) {
        throw new Error(`failed to register fcm token: ${error.message}`);
    }
}
//log notification sent
async function logNotificationSent(userId, window_period, message) {
    await client_1.db.from("notifications_log").insert({
        user_id: userId,
        window_period,
        message,
        sent_at: new Date().toISOString(),
        delivered: true,
    });
}
