/*
this is the application entry point

what it does:
    - create and configure the fastify server
    - register plugins and route groups
    - start background workers
    - listen to incoming requests
*/

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import {config} from "./core/config";
import { logger } from "./core/logger";
import { registerErrorHandler } from "./core/error-handler";
import { registerHealthRoutes } from "./core/health";

//routes
import { authRoutes } from "./routes/auth.routes";
import { goalRoutes } from "./routes/goals.routes";
import { gmailRoutes } from "./routes/gmail.routes";
import { dashboardRoutes }    from "./routes/dashboard.routes";
import { applicationRoutes }  from "./routes/application.routes";
import { historyRoutes }      from "./routes/history.routes";
import { notificationRoutes } from "./routes/notifications.routes";
import { accountRoutes }      from "./routes/account.routes";

//workers
import { startQuarantineRetryCron } from "./workers/quarantine-retry.worker";
import { emailScanWorker } from "./workers/email-scan.worker";
import { startDailySummaryCron } from "./workers/daily-summary.worker";
import { startNotificationCron } from "./workers/notification.worker";
import { startGmailWatchRenewalCron } from "./workers/gmail-watcher-renewal.worker";
import { startCleanupCron } from "./workers/cleanup.worker";


/* 
buildServer is responsible for creating and configuring the fastify app

what it does:
    - initialize the server instance
    - register global plugins (cors, cookies)
    - register all route groups
    - define base system routes for health check

returns: 
    - configured fastify app
*/

async function buildServer() {
    const app = Fastify({
        logger:false
    });

    /*
    plugin 1: cross origin resource setup (cors)

    purpose: 
        - allow frontend to call the backend
        - enable cookies to be sent across origins

    config: 
        - origin: only allow request from frontend url
        - credentials: must be true to allow cookies to be sent
    */

    await app.register(cors, {
        origin: config.frontend.url,
        credentials: true //required for the mtl to work
    });

    /*
    plugin 2: cookie setup

    purpose: 
        - parse cookies from incoming requests
        - enable settings cookies in responses

    config: 
        - used to sign cookies to detect tampering
    */

   await app.register(cookie,{
    secret: config.jwt.secret,
   });

    //error handling
    registerErrorHandler(app);

    //health check
    await registerHealthRoutes(app);

    /*
    register all every route group related endpoints

    example: 
        - /google -> /api/auth/google
    */

   await app.register(authRoutes,{prefix: "/api/auth",});
   await app.register(goalRoutes,         { prefix: "/api/goals" });
   await app.register(gmailRoutes,        { prefix: "/api/gmail" });
   await app.register(dashboardRoutes,    { prefix: "/api/dashboard" });
   await app.register(applicationRoutes,  { prefix: "/api/applications" });
   await app.register(historyRoutes,      { prefix: "/api/history" });
   await app.register(notificationRoutes, { prefix: "/api/notifications" });
   await app.register(accountRoutes,      { prefix: "/api/account" })

  return app //return configured server (not started yet)
}


/*
main application entry point

purpose:
    - bootstraps and starts the server
    - start listening on the configured port
    - handle startup errors
 */

async function main() {
    //build the configured app
    const app = await buildServer();

    /* 
    start server

    config:
        - port -> from environment
        - host -> "0.0.0.0" for external access
    */
    await app.listen(
        {
            port: config.port,
            host: "0.0.0.0",
        }
    );
    logger.info("Server started", { port: config.port, env: config.env });


    /*
    background worker startup

    importing emailScanWorker starts automatically

    purpose:
        - listens for queued email scan jobs
        - processes Gmail notifications in the background
    */
    void emailScanWorker;
    logger.info("✅ Email scan worker running");


    /* 
    background cron startup

    what it does:
        - start the daily summary scheduler after server is running
        - check every minute for users who just reached midnight
        - generate daily summary and update streak and carryover automatically
    */
    startDailySummaryCron();
    logger.info("✅ Daily summary cron running");


    //handle the notification process
    startNotificationCron();
    logger.info("✅ Notification cron running");

    startQuarantineRetryCron();
    logger.info("✅ Quarantine retry cron running");

    startGmailWatchRenewalCron();
    logger.info("✅ Gmail watch renewal cron running");

    startCleanupCron();
    logger.info("Cleanup cron running");

    // Shut down the server gracefully
    const shutdown = async (signal: string) => {
        logger.info("Shutdown signal received", { signal });

        await app.close();

        logger.info("Server closed — goodbye");
        process.exit(0);
    }

    // Listen for operating system shutdown signals
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // console.log(`✅ Server running on port ${config.port}`);
    // console.log(`✅ Email scan worker running`);
    // console.log(`✅ Daily summary cron running`);
    // console.log(`✅ Notification cron running`);
}

main().catch((err) => {
  // Log startup errors before exiting
  logger.error("Failed to start server", {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  process.exit(1);
});