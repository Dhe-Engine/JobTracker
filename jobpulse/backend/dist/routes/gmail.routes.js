"use strict";
/*
gmailRoutes is a route registration function

purpose:
    - registers all Gmail integration related routes on the Fastify app

responsibilities:
    - connect a user's Gmail account for inbox monitoring
    - disconnect Gmail and stop inbox monitoring
    - receive Gmail push notifications from Google Pub/Sub
    - finds which user the email belongs to
    - enqueue background jobs to scan for new emails

parameter:
    - app -> FastifyInstance (server object)
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.gmailRoutes = gmailRoutes;
const middleware_1 = require("../core/middleware");
const gmail_service_1 = require("../services/gmail.service");
const email_scan_worker_1 = require("../workers/email-scan.worker");
const client_1 = require("../db/client");
const logger_1 = require("../core/logger");
//register all gmail related routes
async function gmailRoutes(app) {
    /*
    route 1: connect Gmail inbox monitoring

    method:
        POST

    path:
        /api/gmail/connect

    function:
        - The user must have a Gmail token.
        - Gmail "watch" notifications must be enabled.
        - The database must mark Gmail as connected.
    */
    app.post("/connect", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const userId = req.user.userId;
        //step 1: verify gmail access exists
        const { data: user } = await client_1.db
            .from("users")
            .select("gmail_token")
            .eq("id", userId)
            .single();
        if (!user?.gmail_token) {
            return reply.status(400).send({
                error: "No Gmail token found. Please sign in with Google first to grant Gmail access.",
            });
        }
        try {
            //step 2: Gmail to start sending notifications
            await (0, gmail_service_1.setupGmailWatch)(userId);
            //step 3: mark gmail as connected
            await client_1.db
                .from("users")
                .update({ gmail_connected: true })
                .eq("id", userId);
            return reply.send({
                ok: true,
                message: "Gmail connected",
            });
        }
        catch (err) {
            // console.error("[gmail/connect] failed to setup gmail watch", err);
            logger_1.logger.error("Gmail watch setup failed", {
                userId,
                error: err,
            });
            return reply.status(500).send({
                error: "Failed to connect Gmail. Check that your Google Cloud Pub/Sub topic is configured.",
            });
        }
    });
    /*
    route 2: disconnnect gmail inbox monitoring

    method: POST
    path: /api/gmail/disconnect

    what it does:
        - requires authentication
        - stop gmail watch subscription
        - removes stored gmail token and metadata
    */
    app.post("/disconnect", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const userId = req.user.userId;
        //stop gmail notifications
        await (0, gmail_service_1.disconnectGmail)(userId);
        //update database
        await client_1.db
            .from("users")
            .update({ gmail_connected: false })
            .eq("id", userId);
        return reply.send({
            ok: true,
            message: "Gmail disconnected",
        });
    });
    /*
    route 3: handle gmail push notifications webhook

    method: POST
    path: /api/gmail/push

    what it does:
        - receives webhook notification from google pub/sub
        - decode the notification payload
        - finds the corresponding user
        - creates a background job to scan for new emails
    */
    app.post("/push", async (req, reply) => {
        //immediately acknowledge receipt
        reply.status(200).send({ ok: true });
        try {
            const messageData = req.body?.message?.data;
            //validate if notification payload exists
            if (!messageData) {
                // console.warn("[gmail/push] received push with no data");
                logger_1.logger.warn("Received Gmail push notification with no data");
                return;
            }
            //decode base64 notifs payload
            const decoded = Buffer.from(messageData, "base64").toString("utf-8");
            const notification = JSON.parse(decoded);
            //validate required notifications field
            if (!notification.emailAddress || !notification.historyId) {
                // console.warn("[gmail/push] malformed notification:", notification);
                logger_1.logger.warn("Received malformed Gmail push notification", {
                    notification,
                });
                return;
            }
            //find user by email
            const { data: user } = await client_1.db
                .from("users")
                .select("id, notifications_enabled")
                .eq("email", notification.emailAddress)
                .single();
            if (!user) {
                // console.warn(
                //     `[gmail/push] no user found for ${notification.emailAddress}`
                // );
                logger_1.logger.warn("No user found for Gmail push notification", {
                    email: notification.emailAddress,
                });
                return;
            }
            //enqueue inbox scan job
            await email_scan_worker_1.emailScanQueue.add("scan-inbox", {
                userId: user.id,
                historyId: notification.historyId,
            }, {
                //useful for debugging and to prevent duplicate jobs
                jobId: `scan-${user.id}-${notification.historyId}`,
            });
            //log successful enqueue
            // console.log(`[gmail/push] enqueued scan job for user ${user.id}, historyId ${notification.historyId}`);
            logger_1.logger.info("Gmail inbox scan job enqueued", {
                userId: user.id,
                historyId: notification.historyId,
            });
        }
        catch (err) {
            //log errors safely
            // console.error("[gmail/push] error processing push notification:", err);
            logger_1.logger.error("Failed to process Gmail push notification", {
                error: err,
            });
        }
    });
}
