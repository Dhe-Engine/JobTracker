"use strict";
/*
this file handles all endpoints connected to dashboard

what it does:
    - it fetches the dashboard payload i.e. progress, streak, recent activity
    - manages the ui shame screen action
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRoutes = dashboardRoutes;
const middleware_1 = require("../core/middleware");
const dashboard_service_1 = require("../services/dashboard.service");
const client_1 = require("../db/client");
async function dashboardRoutes(app) {
    /**
     * GET
     * /api/dashboard
     */
    app.get("/", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const payload = await (0, dashboard_service_1.getDashboardPayload)(req.user.userId);
        return reply.send(payload);
    });
    /**
     * POST
     * /api/dashboard/dismiss-shame
     */
    app.post("/dismiss-shame", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const { error } = await client_1.db
            .from("streaks")
            .update({ shame_screen_pending: false })
            .eq("user_id", req.user.userId);
        if (error) {
            return reply
                .status(500)
                .send({ error: "failed to dismiss shame screen" });
        }
        return reply.send({ ok: true });
    });
}
