"use strict";
/**
 * this file provides the user activity history
 *
 * returns
 *  -  actvitiy from last 7 days
 *  - activity from last 30 days
 *
 * Delegate all data processing to the history service
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyRoutes = historyRoutes;
const middleware_1 = require("../core/middleware");
const history_service_1 = require("../services/history.service");
async function historyRoutes(app) {
    /*
    GET /api/history/weekly

    return last 7 days activity
    */
    app.get("/weekly", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const history = await (0, history_service_1.getWeeklyHistory)(req.user.userId);
        return reply.send(history);
    });
    /**
     * GET /api/history/monthly
     *
     * return last 30 days activity, streaks
     */
    app.get("/monthly", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const history = await (0, history_service_1.getMonthlyHistory)(req.user.userId);
        return reply.send(history);
    });
}
