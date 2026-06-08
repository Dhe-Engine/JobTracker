"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.goalRoutes = goalRoutes;
const zod_1 = require("zod");
const middleware_1 = require("../core/middleware");
const goal_services_1 = require("../services/goal.services");
async function goalRoutes(app) {
    /**
     goalRoutes

    responsibilities:
        - retrieve the user active goal
        - create or update a goal
        - validate incoming request data
        - enforce authentication via middleware
    */
    //step 1:get active goal, method: GET | path: /api/goals/active
    app.get("/active", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const userId = req.user.userId;
        //calculate effective target
        const summary = await (0, goal_services_1.computeEffectiveTarget)(userId);
        //handle no goal case
        if (!summary) {
            return reply.status(200).send({
                goal: null,
                message: "no active goal set"
            });
        }
        //return computed goal summary
        return reply.send({ goal: summary });
    });
    //step 2: create or update goal | method: POST | path: /api/goals
    app.post("/", { preHandler: middleware_1.requireAuth }, async (req, reply) => {
        const schema = zod_1.z.object({
            period_type: zod_1.z.enum(["daily", "weekly"]),
            target: zod_1.z
                .number()
                .int("target must be a whole number")
                .min(1, "target must be atleast 1")
                .max(500, "target cannot exceed 500")
        });
        const input = schema.parse(req.body);
        await (0, goal_services_1.setGoal)(req.user.userId, input);
        const summary = await (0, goal_services_1.computeEffectiveTarget)(req.user.userId);
        return reply.status(201).send({
            message: "goal saved",
            goal: summary,
        });
    });
}
