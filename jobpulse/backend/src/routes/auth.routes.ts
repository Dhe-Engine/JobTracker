import type { FastifyInstance } from "fastify";
import { getGoogleAuthUrl,handleGooglecallback } from "../services/auth.service";
import { requireAuth } from "../core/middleware";
import { db } from "../db/client";
import { config } from "../core/config";
import { string } from "zod";
import { error } from "node:console";


/*
authroutes is a route registration function

purpose:
    - registers all authentication related routes on the fastify app

parameter: 
    - app -> fastifyinstance (server object)
*/

export async function authRoutes(app: FastifyInstance) {

    /*
    route 1: start the google oauth login flow

    method: GET 
    path: /api/auth/google

    function:
        - generates the google consent screen url
        - redirects the user to google to approve access
    */

    app.get("/google", async (_req, reply) => {
        const url = getGoogleAuthUrl();
        return reply.redirect(url);
    });


    /*
    route 2: handle the redirection from google after login

    method: GET
    path: /api/auth/google/callback

    responsiblilities:
        - receives authorization code from google
        - completes the oauth flow via google callback
        - set a secure session cookie (jwt)
        - redirects the user back to frontend
        - handles user denied access
        - check for missing authorization code
        - verify for internal authentication failure
    */
    app.get<{Querystring: {code? :string; error?: string }}> (
        "/google/callback",
        async(req, reply) => {

            //step 1: check if user is denied access on google consent screen
            if (req.query.error){
                return reply.redirect(`${config.frontend.url}/?error=access_denied`); 
            }

            //step 2: check for missing authorization code
            if(!req.query.code){
                return reply.redirect(`${config.frontend.url}/?error = missing_code`);
            }

            try{
                //step 3: complete oauth flow and generate session token
                const {sessionToken} = await handleGooglecallback(req.query.code);

                /*
                step 4: set session cookie

                stores the jwt in a secure cookie

                security action:
                    - httpOnly: to prevent javascript access
                    - secure: only sent over https in production
                    - sameSite: to reduce csrf risk
            
                */
               reply.setCookie("session",sessionToken, {
                httpOnly: true,
                secure: config.env === "production",
                sameSame: "lax",
                maxAge: 60 * 60 * 24 * 7, 
                path: "/",
               });

               //step 5: redirect user to dashboard after login
               return reply.redirect(`${config.frontend.url}/dashboard`);
            }

            catch (err){
                //log error and redirect user to frontend with failure state
                console.error("OAuth callback error:", err);
                return reply.redirect(`${config.frontend.url}/?error=auth_failed`);
            }
        }
    );

    /*
    route 3: get current user

    returns the currently authenticated user's profile

    method: GET
    path: /api/auth/me

    what it does:
        - require a valid session
        - fetches user data from database
        - returns safe, non-sensitive fields to client
    */
   app.get("/me",{preHandler: requireAuth},async (req, reply) => {
        const {data: user} = await db
            .from("users")
            .select("id,email,name,avatar_url,timezone,notifications_enabled,created_at")
            .eq("id",req.user!.userId)
            .single();

            return reply.send({user});
    }
   );

   /*
   route 4: logout

   log out user by clearing session cookie

   method: POST
   path: /api/auth/logout

   authentication is stateless (JWT-based), removing the cookie effectively ends the session.
   */
  app.post("/logout", {preHandler: requireAuth}, async(_req, reply) => {
    //remove session cookie from browser
    reply.clearCookie("session",{path:"/"});

    return reply.send({ok:true});
  });
}