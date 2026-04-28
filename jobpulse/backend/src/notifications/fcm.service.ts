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

