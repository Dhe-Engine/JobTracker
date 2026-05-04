/**
 * this file defines api endpoints for user preferences
 * 
 * what it does:
 *  - saves a device token for notification via fcm
 * - allow user to enable/disable notificaiton
 */


import type { FastifyInstance } from "fastify";
import z from "zod";
import { requireAuth } from "../core/middleware";
import { registerToken } from "../notifications/fcm.service";
import { db } from "../db/client";


export async function notificationRoutes(app: FastifyInstance) {

    //register a device token
    app.post<{Body: {fcm_token: string}}> (
        "/register",
        {preHandler: requireAuth},
        async (req, reply) => {
            const schema = z.object({
                fcm_token: z.string().min(10),
            });

            const {fcm_token} = schema.parse(req.body);
            await registerToken(req.user!.userId, fcm_token);

            return reply.send({ok: true})
        }
    );

    //enable or disable notification for a user
    app.patch<{Body: {enabled: boolean}}> (
        "/preferences",
        {preHandler: requireAuth},
        async (req, reply) => {
            const schema = z.object({
                enabled: z.boolean(),
            });

            const {enabled} = schema.parse(req.body);

            await db
                .from("users")
                .update({notifications_enabled: enabled})
                .eq("id", req.user!.userId);

            return reply.send({ok: true, notifications_enabled: enabled});
        }
    );
}