"use strict";
/**
 * this file handles routes for account actions
 *
 * what it does:
 *  - delte user account
 *  - disconnect gmail service
 *  - revoke token access
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountRoutes = accountRoutes;
const middleware_1 = require("../core/middleware");
const client_1 = require("../db/client");
const gmail_service_1 = require("../services/gmail.service");
const google_auth_library_1 = require("google-auth-library");
const config_1 = require("../core/config");
const auth_service_1 = require("../services/auth.service");
async function accountRoutes(app) {
    /**
    delete account

    DELETE /api/account
     */
    app.delete("/", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const userId = req.user.userId;
        //disconnect gmail
        try {
            await (0, gmail_service_1.disconnectGmail)(userId);
        }
        catch (err) {
            console.warn(`[account] gmail disconnect failed for ${userId}`, err);
        }
        //revoke google oauth token
        try {
            const { data: user } = await client_1.db
                .from("users")
                .select("gmail_token")
                .eq("id", userId)
                .single();
            if (user?.gmail_token) {
                const decrypted = (0, auth_service_1.decryptToken)(user.gmail_token);
                const tokenData = JSON.parse(decrypted);
                const oauthClient = new google_auth_library_1.OAuth2Client(config_1.config.google.clientId);
                /*
                revoke refresh token instead of access token
                since refresh token is long lived while
                access token automatically expires
                */
                if (tokenData.refresh_token) {
                    await oauthClient.revokeToken(tokenData.refresh_token);
                }
            }
        }
        catch (err) {
            console.warn(`[account] Token revocation failed for ${userId}`, err);
        }
        //delete user from database
        const { error } = await client_1.db
            .from("users")
            .delete()
            .eq("id", userId);
        if (error) {
            return reply.status(500).send({ error: "Failed to delete account" });
        }
        reply.clearCookie("session", {
            path: "/",
            httpOnly: true,
            secure: config_1.config.env === "production",
            sameSite: "lax",
        });
        return reply.send({
            ok: true,
            message: "Account and all data permanently deleted",
        });
    });
}
