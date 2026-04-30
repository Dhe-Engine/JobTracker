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
import { authRoutes } from "./routes/auth.routes";
import { goalRoutes } from "./routes/goals.routes";
import { gmailRoutes } from "./routes/gmail.routes";
import { emailScanWorker } from "./workers/email-scan.worker";
import { startDailySummaryCron } from "./workers/daily-summary.worker";
import { startNotificationCron } from "./workers/notification.worker";


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
    const app = Fastify({logger:true});

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


   /*
   route group: authentication routes setup

   register all auth related endpoints

    example: 
        - /google -> /api/auth/google
    */

   await app.register(authRoutes,{
    prefix: "/api/auth",
   });


   /**
   register all the goal related endpoints
    */

   await app.register(goalRoutes, {
    prefix: "/api/goals"
   })


   /*
   register gmail integration routes
   */

  await app.register(gmailRoutes, {
    prefix: "/api/gmail"
  });

  /*
  background worker startup
  
  importing emailScanWorker starts automatically

  purpose:
    - listens for queued email scan jobs
    - processes Gmail notifications in the background
  */
  emailScanWorker;


   /*
   system route: health check setup

   function:
    - used by hosting platform
    - quick check if server is running and responsive

   method: GET 
   path: /health
   */

  app.get("/health", async () => {
    return {status: "ok"};
  });


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

   /* 
   background cron startup

   what it does:
        - start the daily summary scheduler after server is running
        - check every minute for users who just reached midnight
        - generate daily summary and update streak and carryover automatically
   */
  startDailySummaryCron();

  //handle the notification process
  startNotificationCron();
  
  console.log(`server running on port ${config.port}`);

}

//handle startup errors
main().catch((err) => {
console.error(err);
process.exit(1);
});
