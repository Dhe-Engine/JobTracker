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
exports.fetchEmailFull = fetchEmailFull;
const googleapis_1 = require("googleapis");
const client_1 = require("../db/client");
const auth_service_1 = require("./auth.service");
const config_1 = require("../core/config");
const logger_1 = require("../core/logger");
async function setupGmailWatch(userId) {
    // console.log(`[gmail] Setting up watch for user ${userId}`);
    logger_1.logger.info("Setting up Gmail watch for user", {
        userId,
    });
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
    const topicName = config_1.config.google.pubsubTopic;
    // console.log(`[gmail] Using Pub/Sub topic: ${topicName}`);
    logger_1.logger.debug("Using Gmail Pub/Sub topic", {
        userId,
        topicName,
    });
    //register gmail watch
    let data;
    try {
        const response = await gmail.users.watch({
            userId: "me",
            requestBody: {
                topicName,
                labelIds: ["INBOX"],
            },
        });
        data = response.data;
    }
    catch (err) {
        // Log the full error so Railway shows exactly what Gmail rejected
        logger_1.logger.error("Failed to register Gmail watch", {
            userId,
            message: err?.message,
            code: err?.code,
            status: err?.status,
            errors: err?.errors,
        });
        throw err;
    }
    const expiry = data.expiration != null ? Number(data.expiration) : null;
    if (expiry != null && Number.isNaN(expiry)) {
        throw new Error("Invalid gmail expiration value returned from watch");
    }
    await client_1.db
        .from("users")
        .update({
        gmail_history_id: data.historyId ?? null,
        gmail_watch_expiry: expiry,
    })
        .eq("id", userId);
    // console.log(`[gmail] Watch set up successfully`, {
    //   userId,
    //   historyId: data.historyId,
    //   expiresAt: expiry ? new Date(expiry).toISOString() : null,
    // });
    logger_1.logger.info("Gmail watch registered", {
        userId,
        historyId: data.historyId,
        expiresAt: expiry ? new Date(expiry).toISOString() : null,
    });
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
    let historyData;
    try {
        const res = await gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            labelId: "INBOX",
        });
        historyData = res.data;
    }
    catch (err) {
        if (err?.code === 404) {
            // console.warn(
            //   `[gmail] historyId expired for user ${userId}, resetting watch`
            // );
            logger_1.logger.warn("Gmail historyId expired, resetting watch", {
                userId,
                historyId: startHistoryId,
            });
            // reset watch instead of failing worker
            await setupGmailWatch(userId);
            return [];
        }
        throw err;
    }
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
    const emailResults = [];
    for (let i = 0; i < uniqueMessageIds.length; i += BATCH_SIZE) {
        const batch = uniqueMessageIds.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map((msgId) => fetchEmailFull(gmail, msgId)));
        emailResults.push(...results);
    }
    //filter valid results
    const validEmails = emailResults.filter((e) => e !== null);
    //safe history id fallback
    const nextHistoryId = historyData.historyId ?? historyId;
    //update bookmark
    await updateHistoryId(userId, nextHistoryId);
    return validEmails;
}
// async function fetchEmailMetadata(
//     gmail:ReturnType<typeof google.gmail>,
//     messageId: string
// ): Promise<EmailMetadata | null> {
//     /*
//     fetch the metadata for a single email
//     returns: 
//         - subject
//         - sender
//         - received timestamp
//     */
//     try {
//         const {data:message} = await gmail.users.messages.get({
//             userId: "me",
//             id: messageId,
//             format: "metadata",
//             metadataHeaders: ["Subject", "From", "Date"],
//         });
//         const headers = message.payload?.headers ?? [];
//         //get header value by name
//         const getHeader = (name: string): string => {
//             const header = headers.find(
//                 (h) => h.name?.toLowerCase() === name.toLowerCase()
//             );
//             return header?.value ?? "";
//         };
//         const subject = getHeader("Subject");
//         const from = getHeader("From");
//         const dateStr = getHeader("Date");
//         //skip emails with no useful data
//         if (!subject && !from) return null;
//         //parse timestamp
//         const receivedAt = dateStr
//            ? new Date(dateStr).toISOString()
//            : new Date().toISOString();
//         return {
//             gmail_message_id: messageId,
//             subject,
//             from,
//             received_at: receivedAt,
//             body,
//         };
//     } catch (err) {
//         console.error(`failed to fetch email ${messageId}:`,err);
//         return null;
//     }
// }
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
    catch (err) {
        logger_1.logger.warn("Failed to stop Gmail watch during disconnect", {
            userId,
            error: err instanceof Error ? err.message : String(err),
        });
    }
    //clear stored credentials and sync state
    await client_1.db
        .from("users")
        .update({
        gmail_token: null,
        gmail_history_id: null,
        gmail_watch_expiry: null,
        gmail_connected: false
    })
        .eq("id", userId);
}
/*
|--------------------------------------------------------------------------
| NEW FUNCTION: fetchEmailFull
|--------------------------------------------------------------------------
|
| Fetches one complete email from Gmail.
|
| Unlike fetchEmailMetadata(), this function downloads much more information.
|
| It collects:
| • Subject
| • Sender
| • Date received
| • Plain-text email body
|
| The email scan worker uses this function so the AI classifier can read
| enough of the email to decide whether it is a real job application.
|
| Example:
|
| Gmail
|   ↓
| "Thanks for applying to Software Engineer..."
|   ↓
| fetchEmailFull()
|   ↓
| {
|   subject: "...",
|   from: "...",
|   body: "Thank you for applying..."
| }
|
|--------------------------------------------------------------------------
*/
/**
 * Downloads a complete Gmail message.
 *
 * @param gmail Authenticated Gmail client.
 * @param messageId Gmail's unique ID for the email.
 * @returns Email information, or null if the email could not be read.
 */
async function fetchEmailFull(gmail, messageId) {
    try {
        /*
        |--------------------------------------------------------------------------
        | Ask Gmail for the complete email
        |--------------------------------------------------------------------------
        |
        | format: "full" includes:
        | • headers
        | • body
        | • attachments metadata
        | • multipart sections
        |
        | This gives us much more information than "metadata".
        |
        |--------------------------------------------------------------------------
        */
        const { data: message } = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full",
        });
        // Email headers (Subject, From, Date, etc.)
        const headers = message.payload?.headers ?? [];
        /**
         * Finds a specific email header.
         *
         * Example:
         * getHeader("Subject")
         * getHeader("From")
         * getHeader("Date")
         */
        const getHeader = (name) => {
            const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
            return header?.value ?? "";
        };
        // Read the important headers
        const subject = getHeader("Subject");
        const from = getHeader("From");
        const dateStr = getHeader("Date");
        // If both are missing, the email isn't useful
        if (!subject && !from)
            return null;
        /*
        |--------------------------------------------------------------------------
        | Convert the email date into ISO format
        |--------------------------------------------------------------------------
        |
        | ISO dates are consistent and easy to store in the database.
        |
        | If Gmail doesn't provide a date, use the current time instead.
        |
        |--------------------------------------------------------------------------
        */
        const receivedAt = dateStr
            ? new Date(dateStr).toISOString()
            : new Date().toISOString();
        /*
        |--------------------------------------------------------------------------
        | Read the email body
        |--------------------------------------------------------------------------
        |
        | Gmail stores the body in a nested structure.
        | The helper function walks through that structure and returns
        | readable plain text.
        |
        |--------------------------------------------------------------------------
        */
        const body = extractPlainTextBody(message.payload);
        // Return everything the worker needs
        return {
            gmail_message_id: messageId,
            subject,
            from,
            received_at: receivedAt,
            body,
        };
    }
    catch (err) {
        // console.error(`[gmail] Failed to fetch full email ${messageId}:`, err);
        logger_1.logger.error("Failed to fetch Gmail message", {
            messageId,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
        });
        return null;
    }
}
/*
|--------------------------------------------------------------------------
| HELPER: extractPlainTextBody
|--------------------------------------------------------------------------
|
| Finds readable text inside a Gmail email.
|
| Gmail emails can be surprisingly complicated.
|
| Some contain:
| • Plain text
| • HTML
| • Nested multipart sections
| • Attachments
|
| This helper searches through the email until it finds something
| humans can read.
|
|--------------------------------------------------------------------------
*/
/**
 * Extracts readable text from Gmail's nested email structure.
 *
 * @param payload Gmail message payload.
 * @param depth Current recursion depth.
 * @returns Plain text version of the email body.
 */
function extractPlainTextBody(payload, depth = 0) {
    /*
    |--------------------------------------------------------------------------
    | Safety check
    |--------------------------------------------------------------------------
    |
    | Prevents infinite recursion if the email structure is malformed.
    |
    |--------------------------------------------------------------------------
    */
    if (!payload || depth > 5)
        return "";
    /*
    |--------------------------------------------------------------------------
    | Case 1: Plain text email
    |--------------------------------------------------------------------------
    |
    | The easiest case.
    |
    | Email
    |   ↓
    | text/plain
    |   ↓
    | Decode it and return.
    |
    |--------------------------------------------------------------------------
    */
    if (payload.mimeType === "text/plain" && payload.body?.data) {
        return decodeBase64Body(payload.body.data);
    }
    /*
    |--------------------------------------------------------------------------
    | Case 2: Multipart email
    |--------------------------------------------------------------------------
    |
    | Multipart emails contain several sections.
    | Example:
    |
    | multipart
    | ├── text/plain
    | ├── text/html
    | └── attachments
    |
    |--------------------------------------------------------------------------
    */
    if (payload.parts && Array.isArray(payload.parts)) {
        /*
        |--------------------------------------------------------------------------
        | First choice: plain text
        |--------------------------------------------------------------------------
        |
        | Plain text is easiest for AI to understand.
        |
        |--------------------------------------------------------------------------
        */
        const plainPart = payload.parts.find((p) => p.mimeType === "text/plain");
        if (plainPart?.body?.data) {
            return decodeBase64Body(plainPart.body.data);
        }
        /*
        |--------------------------------------------------------------------------
        | Second choice: HTML
        |--------------------------------------------------------------------------
        |
        | If plain text doesn't exist,
        | remove the HTML tags.
        |
        |--------------------------------------------------------------------------
        */
        const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
        if (htmlPart?.body?.data) {
            const html = decodeBase64Body(htmlPart.body.data);
            return stripHtmlTags(html);
        }
        /*
        |--------------------------------------------------------------------------
        | Third choice: nested multipart sections
        |--------------------------------------------------------------------------
        |
        | Some emails contain more multipart sections inside multipart sections.
        |
        | We search each one until we find readable text.
        |
        |--------------------------------------------------------------------------
        */
        for (const part of payload.parts) {
            const result = extractPlainTextBody(part, depth + 1);
            if (result) {
                return result;
            }
        }
    }
    // Nothing useful found
    return "";
}
/*
|--------------------------------------------------------------------------
| HELPER: decodeBase64Body
|--------------------------------------------------------------------------
|
| Gmail stores email bodies using URL-safe Base64 encoding.
|
| Humans cannot read Base64 directly.
|
| This helper converts:
|
| SGVsbG8gd29ybGQ=
|
| into:
|
| Hello world
|
|--------------------------------------------------------------------------
*/
/**
 * Converts Gmail's Base64 email body into readable text.
 *
 * @param encoded Encoded email body.
 * @returns Decoded plain text.
 */
function decodeBase64Body(encoded) {
    try {
        /*
        |--------------------------------------------------------------------------
        | Gmail uses URL-safe Base64
        |--------------------------------------------------------------------------
        |
        | Replace Gmail's special characters with normal Base64 characters.
        |
        |--------------------------------------------------------------------------
        */
        const standard = encoded
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        // Decode into UTF-8 text
        const decoded = Buffer
            .from(standard, "base64")
            .toString("utf-8");
        /*
        |--------------------------------------------------------------------------
        | Keep only the first 3000 characters
        |--------------------------------------------------------------------------
        |
        | This is usually more than enough for AI classification while
        | keeping API costs low.
        |
        |--------------------------------------------------------------------------
        */
        return decoded.slice(0, 3000);
    }
    catch {
        // Invalid Base64
        return "";
    }
}
/*
|--------------------------------------------------------------------------
| HELPER: stripHtmlTags
|--------------------------------------------------------------------------
|
| Converts HTML emails into readable plain text.
|
| Example:
|
| <p>Hello <strong>John</strong></p>
|
| becomes:
|
| Hello John
|
|--------------------------------------------------------------------------
*/
/**
 * Removes HTML tags from an email.
 *
 * Also converts common HTML entities into normal characters.
 *
 * @param html HTML version of the email.
 * @returns Clean plain text.
 */
function stripHtmlTags(html) {
    return html
        // Convert line break tags into real new lines
        .replace(/<br\s*\/?>/gi, "\n")
        // End of paragraph becomes a new line
        .replace(/<\/p>/gi, "\n")
        // Remove every remaining HTML tag
        .replace(/<[^>]+>/g, "")
        // Decode common HTML entities
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        // Prevent huge blocks of empty lines
        .replace(/\n{3,}/g, "\n\n")
        // Remove extra spaces around the text
        .trim()
        // Keep the text short enough for AI processing
        .slice(0, 3000);
}
