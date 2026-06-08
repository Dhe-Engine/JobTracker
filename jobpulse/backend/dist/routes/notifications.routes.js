"use strict";
/**
 * this file defines api endpoints for user preferences
 *
 * what it does:
 *  - saves a device token for notification via fcm
 * - allow user to enable/disable notificaiton
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRoutes = notificationRoutes;
const zod_1 = __importDefault(require("zod"));
const middleware_1 = require("../core/middleware");
const fcm_service_1 = require("../notifications/fcm.service");
const client_1 = require("../db/client");
async function notificationRoutes(app) {
    //register a device token
    app.post("/register", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const schema = zod_1.default.object({
            fcm_token: zod_1.default.string().min(10),
        });
        const { fcm_token } = schema.parse(req.body);
        await (0, fcm_service_1.registerToken)(req.user.userId, fcm_token);
        return reply.send({ ok: true });
    });
    //enable or disable notification for a user
    app.patch("/preferences", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const schema = zod_1.default.object({
            enabled: zod_1.default.boolean(),
        });
        const { enabled } = schema.parse(req.body);
        await client_1.db
            .from("users")
            .update({ notifications_enabled: enabled })
            .eq("id", req.user.userId);
        return reply.send({ ok: true, notifications_enabled: enabled });
    });
}
