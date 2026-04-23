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

}