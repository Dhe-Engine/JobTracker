/*
this file handles all endpoints connected to dashboard

what it does:
    - it fetches the dashboard payload i.e. progress, streak, recent activity
    - manages the ui shame screen action
*/

import type { FastifyInstance } from "fastify";
import { requireAuth } from "../core/middleware";
import { getDashboardPayload } from "../services/dashboard.service";
import { db } from "../db/client";


export async function dashboardRoutes(app:FastifyInstance) {

    /**
     * GET
     * /api/dashboard
     */
    app.get(
        "/",
        {preHandler: requireAuth},
        async (req, reply) => {
            const payload = await getDashboardPayload(req.user!.userId);
            return reply.send(payload);
        }
    );

    /**
     * POST
     * /api/dashboard/dismiss-shame
     */
    app.post(
        "/dismiss-shame",
        {preHandler: requireAuth},
        async (req, reply) => {
            const {error} = await db
                .from("streaks")
                .update({shame_screen_pending:false})
                .eq("user_id", req.user!.userId);

            if(error){
                return reply
                    .status(500)
                    .send({error: "failed to dismiss shame screen"});
            }

            return reply.send({ok: true});
        }
    );
}
