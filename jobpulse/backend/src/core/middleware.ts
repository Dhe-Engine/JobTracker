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