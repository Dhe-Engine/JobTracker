"use strict";
/*
what this service does:
    - handles integration with gmail api
    - setup gmail push up notifications
    - fetch new emails since the last processed state
    - disconnect gmail and clean user data
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupGmailWatch = setupGmailWatch;
exports.getNewEmails = getNewEmails;
exports.disconnectGmail = disconnectGmail;
const googleapis_1 = require("googleapis");
const client_1 = require("../db/client");
const auth_service_1 = require("./auth.service");
async function setupGmailWatch(userId) {
    /*
    setup gmail notifications

    purpose:
        - get oauth gmail client
        - register watch with gmail
        - gmail notifications to sub topic when new emails arrive
        - store bookmark and expiration timestamp
    */
    //get oauth gmail client
    const { client } = await (0, auth_service_1.getGmailClientForUser)(userId);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth: client });
    //define sub topic
    const topicName = `projects/${process.env.GCP_PROJECT_ID}/topics/gmail-push`;
    //register gmail watch
    const { data } = await gmail.users.watch({
        userId: "me",
        requestBody: {
            topicName: "projects/fast-art-245200/topics/jobpulse-gmail-push",
            labelIds: ["INBOX"],
        },
    });
    //store bookmark to track last processed email
    const expiry = data.expiration != null ? Number(data.expiration) : null;
    if (expiry != null && Number.isNaN(expiry)) {
        throw new Error("invalid gmail expiration value");
    }
    await client_1.db
        .from("users")
        .update({
        gmail_history_id: data.historyId ?? null,
        gmail_watch_expiry: expiry
    })
        .eq("id", userId);
}
async function getNewEmails(userId, historyId) {
    /*
    retrieve new emails since the last processed state

    returns:
        - arrays of subject, sender, timestamp
    */
    //get gmail client
    const { client } = await (0, auth_service_1.getGmailClientForUser)(userId);
    const gmail = googleapis_1.google.gmail({ version: "v1", auth: client });
    //get stored historyId
    const { data: user } = await client_1.db
        .from("users")
        .select("gmail_history_id")
        .eq("id", userId)
        .single();
    const startHistoryId = user?.gmail_history_id ?? historyId;
    if (!startHistoryId) {
        throw new Error("missing historyId for gmail sync");
    }
    //retrieve history of changes
    const { data: historyData } = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
    });
    const history = historyData.history ?? [];
    //extract message ids
    const newMessageIds = [];
    for (const record of history) {
        for (const msg of record.messagesAdded ?? []) {
            if (msg.message?.id) {
                newMessageIds.push(msg.message.id);
            }
        }
    }
    const uniqueMessageIds = [...new Set(newMessageIds)];
    //handle no new emails
    if (uniqueMessageIds.length === 0) {
        //safe history id fallback
        const nextHistoryId = historyData.historyId ??
            user?.gmail_history_id ??
            historyId;
        await updateHistoryId(userId, nextHistoryId);
        return [];
    }
    //fetch metadata in parallel
    const BATCH_SIZE = 5;
    const emailMetadata = [];
    for (let i = 0; i < uniqueMessageIds.length; i += BATCH_SIZE) {
        const batch = uniqueMessageIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((msgId) => fetchEmailMetadata(gmail, msgId)));
        emailMetadata.push(...results);
    }
    //filter valid results
    const validEmails = emailMetadata.filter((e) => e !== null);
    //safe history id fallback
    const nextHistoryId = historyData.historyId ?? historyId;
    //update bookmark
    await updateHistoryId(userId, nextHistoryId);
    return validEmails;
}
async function fetchEmailMetadata(gmail, messageId) {
    /*
    fetch the metadata for a single email

    returns:
        - subject
        - sender
        - received timestamp
    */
    try {
        const { data: message } = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
        });
        const headers = message.payload?.headers ?? [];
        //get header value by name
        const getHeader = (name) => {
            const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
            return header?.value ?? "";
        };
        const subject = getHeader("Subject");
        const from = getHeader("From");
        const dateStr = getHeader("Date");
        //skip emails with no useful data
        if (!subject && !from)
            return null;
        //parse timestamp
        const receivedAt = dateStr
            ? new Date(dateStr).toISOString()
            : new Date().toISOString();
        return {
            gmail_message_id: messageId,
            subject,
            from,
            received_at: receivedAt,
        };
    }
    catch (err) {
        console.error(`failed to fetch email ${messageId}:`, err);
        return null;
    }
}
async function updateHistoryId(
//updates the stored bookmark
userId, historyId) {
    await client_1.db
        .from("users")
        .update({ gmail_history_id: historyId })
        .eq("id", userId);
}
async function disconnectGmail(userId) {
    /*
     disconnect user's gmail account

     what it does:
        - stop gmail notifications
        - clear stored tokens and sync state
    */
    try {
        const { client } = await (0, auth_service_1.getGmailClientForUser)(userId);
        const gmail = googleapis_1.google.gmail({ version: "v1", auth: client });
        //stop notifications
        await gmail.users.stop({ userId: "me" });
    }
    catch {
        console.warn(`could not stop gmail watch for user ${userId} - continuing`);
    }
    //clear stored credentials and sync state
    await client_1.db
        .from("users")
        .update({
        gmail_token: null,
        gmail_history_id: null,
        gmail_watch_expiry: null,
    })
        .eq("id", userId);
}
