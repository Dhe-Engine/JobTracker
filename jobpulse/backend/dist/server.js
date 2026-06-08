"use strict";
/*
this is the application entry point

what it does:
    - create and configure the fastify server
    - register plugins and route groups
    - start background workers
    - listen to incoming requests
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cookie_1 = __importDefault(require("@fastify/cookie"));
const cors_1 = __importDefault(require("@fastify/cors"));
const config_1 = require("./core/config");
//routes
const auth_routes_1 = require("./routes/auth.routes");
const goals_routes_1 = require("./routes/goals.routes");
const gmail_routes_1 = require("./routes/gmail.routes");
const dashboard_routes_1 = require("./routes/dashboard.routes");
const application_routes_1 = require("./routes/application.routes");
const history_routes_1 = require("./routes/history.routes");
const notifications_routes_1 = require("./routes/notifications.routes");
const account_routes_1 = require("./routes/account.routes");
//workers
const email_scan_worker_1 = require("./workers/email-scan.worker");
const daily_summary_worker_1 = require("./workers/daily-summary.worker");
const notification_worker_1 = require("./workers/notification.worker");
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
    const app = (0, fastify_1.default)({ logger: true });
    /*
    plugin 1: cross origin resource setup (cors)

    purpose:
        - allow frontend to call the backend
        - enable cookies to be sent across origins

    config:
        - origin: only allow request from frontend url
        - credentials: must be true to allow cookies to be sent
    */
    await app.register(cors_1.default, {
        origin: config_1.config.frontend.url,
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
    await app.register(cookie_1.default, {
        secret: config_1.config.jwt.secret,
    });
    /*
    register all every route group related endpoints
 
     example:
         - /google -> /api/auth/google
     */
    await app.register(auth_routes_1.authRoutes, { prefix: "/api/auth", });
    await app.register(goals_routes_1.goalRoutes, { prefix: "/api/goals" });
    await app.register(gmail_routes_1.gmailRoutes, { prefix: "/api/gmail" });
    await app.register(dashboard_routes_1.dashboardRoutes, { prefix: "/api/dashboard" });
    await app.register(application_routes_1.applicationRoutes, { prefix: "/api/applications" });
    await app.register(history_routes_1.historyRoutes, { prefix: "/api/history" });
    await app.register(notifications_routes_1.notificationRoutes, { prefix: "/api/notifications" });
    await app.register(account_routes_1.accountRoutes, { prefix: "/api/account" });
    /*
    system route: health check setup

    function:
    - used by hosting platform
    - quick check if server is running and responsive

    method: GET
    path: /health
    */
    app.get("/health", async () => ({ status: "ok" }));
    return app; //return configured server (not started yet)
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
    await app.listen({
        port: config_1.config.port,
        host: "0.0.0.0",
    });
    /*
    background worker startup

    importing emailScanWorker starts automatically

    purpose:
        - listens for queued email scan jobs
        - processes Gmail notifications in the background
    */
    void email_scan_worker_1.emailScanWorker;
    /*
    background cron startup

    what it does:
        - start the daily summary scheduler after server is running
        - check every minute for users who just reached midnight
        - generate daily summary and update streak and carryover automatically
    */
    (0, daily_summary_worker_1.startDailySummaryCron)();
    //handle the notification process
    (0, notification_worker_1.startNotificationCron)();
    console.log(`✅ Server running on port ${config_1.config.port}`);
    console.log(`✅ Email scan worker running`);
    console.log(`✅ Daily summary cron running`);
    console.log(`✅ Notification cron running`);
}
//handle startup errors
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
