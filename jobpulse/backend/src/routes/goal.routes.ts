

import type { FastifyInstance } from "fastify";
import {z} from "zod";
import { requireAuth } from "../core/middleware";
import {setGoal, getActiveGoal, computeEffectiveTarget} from "../services/goal.services";

export async function goalRoutes(app:FastifyInstance) {
    /**
     goalRoutes

    responsibilities:
        - retrieve the user active goal
        - create or update a goal
        - validate incoming request data
        - enforce authentication via middleware
    */

    //step 1:get active goal, method: GET | path: /api/goals/active
    app.get(
        "/active",
        {preHandler: requireAuth},
        async (req, reply) => {

            const userId = req.user!.userId;

            //calculate effective target
            const summary = await computeEffectiveTarget(userId);

            //handle no goal case
            if (!summary) {
                return reply.status(200).send({
                    goal: null,
                    message: "no active goal set"
                });
            }

            //return computed goal summary
            return reply.send({goal: summary});

        }
    );

    //step 2: create or update goal | method: POST | path: /api/goals
    app.post<{Body: {period_type: string; target: number}}>(
        "/",
        {preHandler: requireAuth},
        async (req, reply) => {

            const schema = z.object({
                period_type: z.enum(["daily","weekly"]),
                target: z
                    .number()
                    .int("target must be a whole number")
                    .min(1, "target must be atleast 1")
                    .min(500, "target cannot exceed 500")
            });

            const input = schema.parse(req.body);

            await setGoal(req.user!.userId, input);

            const summary = await computeEffectiveTarget(req.user!.userId);

            return reply.status(201).send({
                message: "goal saved",
                goal: summary,
            });
        }
    ); 
}