/**
 * this file handles routes for account actions
 * 
 * what it does:
 *  - delte user account
 *  - disconnect gmail service
 *  - revoke token access
 */


import type { FastifyInstance } from "fastify";
import { requireAuth } from "../core/middleware";
import { db } from "../db/client";
import { disconnectGmail } from "../services/gmail.service";
import { OAuth2Client } from "google-auth-library";
import { config } from "../core/config";
import { decryptToken } from "../services/auth.service";


export async function accountRoutes(app: FastifyInstance) {

    /**
    delete account

    DELETE /api/account
     */
    app.delete(
        "/",
        {preHandler: requireAuth},
        async (req, reply) => {
            const userId = req.user!.userId;

            //disconnect gmail
            try{
                await disconnectGmail(userId);
            }
            catch (err){
                console.warn(`[account] gmail disconnect failed for ${userId}`, err);
            }

            //revoke google oauth token
            try {
                const {data: user} = await db
                    .from("users")
                    .select("gmail_token")
                    .eq("id", userId)
                    .single();

                if(user?.gmail_token){
                    const decrypted = decryptToken(user.gmail_token);

                    const tokenData = JSON.parse(decrypted);

                    const oauthClient = new OAuth2Client(config.google.clientId);

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
            catch (err){
                console.warn(`[account] Token revocation failed for ${userId}`, err)
            }

            //delete user from database
            const { error } = await db
                .from("users")
                .delete()
                .eq("id", userId);

            if (error) {
                return reply.status(500).send({ error: "Failed to delete account" });
            }

            reply.clearCookie("session", {
                path: "/",
                httpOnly: true,
                secure: config.env === "production",
                sameSite: "lax",
            });

            return reply.send({
                ok: true,
                message: "Account and all data permanently deleted",
            });
        }
    );
}
