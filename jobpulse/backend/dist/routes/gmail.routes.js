"use strict";
/*
gmailRoutes is a route registration function

purpose:
    - registers all Gmail integration related routes on the Fastify app

responsibilities:
    - connect a user's Gmail account for inbox monitoring
    - disconnect Gmail and stop inbox monitoring
    - receive Gmail push notifications from Google Pub/Sub
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
async function gmailRoutes(app) {
    /*
    route 1: connect Gmail inbox monitoring

    method:
        POST

    path:
        /api/gmail/connect

    function:
        - requires authentication
        - sets up Gmail watch subscription
        - allows Google to send push notifications when new emails arrive
    */
    app.post("/connect", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        await (0, gmail_service_1.setupGmailWatch)(req.user.userId);
        return reply.send({
            ok: true,
            message: "Gmail connected",
        });
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
        await (0, gmail_service_1.disconnectGmail)(req.user.userId);
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
                console.warn("[gmail/push] received push with no data");
                return;
            }
            //decode base64 notifs payload
            const decoded = Buffer.from(messageData, "base64").toString("utf-8");
            const notification = JSON.parse(decoded);
            //validate required notifications field
            if (!notification.emailAddress || !notification.historyId) {
                console.warn("[gmail/push] malformed notification:", notification);
                return;
            }
            //find user by email
            const { data: user } = await client_1.db
                .from("users")
                .select("id, notifications_enabled")
                .eq("email", notification.emailAddress)
                .single();
            if (!user) {
                console.warn(`[gmail/push] no user found for ${notification.emailAddress}`);
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
            console.log(`[gmail/push] enqueued scan job for user ${user.id}, historyId ${notification.historyId}`);
        }
        catch (err) {
            //log errors safely
            console.error("[gmail/push] error processing push notification:", err);
        }
    });
}
