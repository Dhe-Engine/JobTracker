/**
 * this file provides the user activity history
 * 
 * returns
 *  -  actvitiy from last 7 days
 *  - activity from last 30 days
 * 
 * Delegate all data processing to the history service
 */


import type { FastifyInstance } from "fastify";
import { requireAuth } from "../core/middleware";
import { getWeeklyHistory, getMonthlyHistory } from "../services/history.service";


export async function historyRoutes(app:FastifyInstance) {
    
    /*
    GET /api/history/weekly 

    return last 7 days activity
    */
   app.get(
        "/weekly", {preHandler: requireAuth}, async (req, reply) => {
            const history = await getWeeklyHistory(req.user!.userId);
            return reply.send(history);
        }
   );

   /**
    * GET /api/history/monthly
    * 
    * return last 30 days activity, streaks
    */
   app.get(
    "monthly", {preHandler: requireAuth}, async (req, reply) => {
        const history = await getMonthlyHistory(req.user!.userId);
        return reply.send(history);
    }
   );
}