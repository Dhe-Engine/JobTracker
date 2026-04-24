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


import type { FastifyInstance } from "fastify";
import { requireAuth } from "../core/middleware";
import { setupGmailWatch, disconnectGmail } from "../services/gmail.service";
import { emailScanQueue } from "../workers/email-scan.worker";
import { db } from "../db/client";



export async function gmailRoutes(app: FastifyInstance) {

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

    app.post(
        "/connect",
        { preHandler: requireAuth },
        async (req, reply) => {
            await setupGmailWatch(req.user!.userId);

            return reply.send({
                ok: true,
                message: "Gmail connected",
            });
        }
    );

    /*
    route 2: disconnnect gmail inbox monitoring

    method: POST
    path: /api/gmail/disconnect

    what it does:
        - requires authentication
        - stop gmail watch subscription
        - removes stored gmail token and metadata
    */

    app.post(
        "/disconnect",
        {preHandler: requireAuth},
        async (req, reply) => {

            await disconnectGmail(req.user!.userId);

            return reply.send({
                ok: true,
                message: "gmail disconnected",
            });
        }
    );

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

    app.post<{
        Body: {
            message?: {data?: string; messageId?: string};
            subscription?: string
        };
    }>(
        "/push",
        async (req, reply) => {
            
            //immediately acknowledge receipt
            reply.status(200).send({ok: true});

            try{
                const messageData = req.body?.message?.data;

                //validate if notification payload exists
                if (!messageData) {
                    console.warn("[gmail/push] received push with no data");
                    return;
                }

                //decode base64 notifs payload
                const decoded = Buffer.from(messageData, "base64").toString("utf-8");

                const notification = JSON.parse(decoded) as {
                    emailAddress?: string;
                    historyId?: string;
                };

                //validate required notifications field
                if(!notification.emailAddress || notification.historyId){
                    console.warn("[gmail/push] malformed notification:", notification);
                    return;
                }

                //find user by email
                const {data:user} = await db
                    .from("users")
                    .select("id, notifications_enabled")
                    .eq("email", "notification.emailAddress")
                    .single();

                if (!user) {
                    console.warn(
                        `[gmail/push] no user found for ${notification.emailAddress}`
                    );
                    return;
                }

                //enqueue inbox scan job
                await emailScanQueue.add(
                    "scan-inbox",
                    {
                        userId: user.id,
                        historyId: notification.historyId,
                    },

                    {
                        //useful for debugging and to prevent duplicate jobs
                        jobId: `scan-${user.id}-${notification.historyId}`,
                    }
                );

                //log successful enqueue
                console.log(`[gmail/push] enqueued scan job for user ${user.id}, historyId ${notification.historyId}`);
            }

            catch(err) {
                //log errors safely
                console.error("[gmail/push] error processing push notification:", err);
            }
        }
    );
}