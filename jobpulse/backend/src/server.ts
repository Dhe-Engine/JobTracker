import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import {config} from "./core/config";
import { authRoutes } from "./routes/auth.routes";

/* 
buildServer is responsible for creating and configuring the fastify app

what it does:
    - initialize the server instance
    - register global plugins (cors, cookies)
    - register all route groups
    = define base system routes for health check

returns: 
    - configured fastify app
*/

async function buildServer() {
    const app = Fastify({logger:true});

    /*
    pluigin 1: cross origin resource setup (cors)

    purpose: 
        - allow frontend to call the backend
        - enable cookies to be sent across origins

    config: 
        - origiin: only allow request from frontend url
        - credentials: must be true to allow cookies to be sent
    */

    await app.register(cors, {
        origin: config.frontend.url,
        credentials: true //reqiured for the mtl to work
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

   prefix: 
        - all routes inside authRoutes will be under /api/auth

    example: 
        - /google -> /api/auth/google
    */
   await app.register(authRoutes,{
    prefix: "/api/auth",
   });

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

   console.log(`server running on port ${config.port}`);

}

//catch error during startup
main().catch((err) => {
console.error(err);
process.exit(1);
});
