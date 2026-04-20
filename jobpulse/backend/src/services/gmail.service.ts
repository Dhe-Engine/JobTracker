/*
what this service doEs:
    - handles integration with gmail api
    - setup gmail push up notifications
    - fetch new emails since the last processed state
    - disconnect gmail and clean user data
*/

import {google} from "googleapis";
import { db } from "../db/client";
import { getGmailClientForUser } from "./auth.service";
import type { EmailMetadata } from "../models/application.model";


export async function setupGmailWatch(userId: string): Promise<void> {

    /*
    setup gmail notifications

    purpose:
        - get oauth gmail client
        - register watch with gmail
        - gmail notifications to sub topic when new emails arrive
        - store bookmark and expiration timestamp
    */

    //get oauth gmail client
    const { client } = await getGmailClientForUser(userId);
    const gmail = google.gmail({version: "v1", auth: client});

    //define sub topic
    const topicName = `projects/${process.env.GCP_PROJECT_ID}/topics/gmail-push`;

    //register gmail watch
    const {data} = await gmail.users.watch ({
        userId: "me",
        requestBody: {
            topicName,
            labelIds: ["INBOX"],
        },
    });

    //store bookmark to track last processed email

    const expiry = data.expiration != null ? Number(data.expiration): null;

    if (expiry !== null && Number.isNaN(expiry)){
        throw new Error("invalid gmail expiration value");
    }

        await db
            .from("users")
            .update({
                gmail_history_id: data.historyId ?? null,
                gmail_watch_expiry: expiry
            })
            .eq("id", userId);
    
    
}