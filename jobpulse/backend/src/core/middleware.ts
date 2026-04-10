import type {FastifyRequest, FastifyReply} from "fastify";
import { verifySessionToken } from "../services/auth.service";


/*
extend fastify request type

adds a user property to the fastify request object

after authentication runs, route handlers can safely access:
    - req.user.userId
    - req.user.email
*/

declare module "fastify" {
    interface FastifyRequest{
        user?: {userId: string, email:string};
    }
}

/*
authentication middleware (route guard)

it protects routes by requiring a valid session

what it does:
    1. reads the session token from cookies
    2. verifies the token by checking signature and expiration
    3. attaches the decoded user payload to the request
    4. rejects the request if authentication fails
*/
export async function requireAuth(
    req: FastifyRequest,
    reply: FastifyReply
){
     //step 1: read session taken from cookies during login
     const token = req.cookies?.session;

     //step 2: check if token exists
     if (!token){
        return reply.status(401).send({error: "not authenticated"});
     }

     try{
        //step3: validate token and extract user data
        const payload = verifySessionToken(token)

        //step 4: attach user info to request for downstream handlers
        req.user = payload;
     }
     catch{
        //step 5: handle token invalid (expired or tampered with)
        return reply
            .status(401)
            .send({error:"session expired - please login again"});
     }
}