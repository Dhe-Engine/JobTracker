/*
defines all api related to job applications

it does the following:
    - handle request from the ui
    - allow user perform CRUD operation on job application
    - user can only view their own information
*/

import type { FastifyInstance } from "fastify";
import {z} from "zod";
import { requireAuth } from "../core/middleware";
import { db } from "../db/client";
import { getTodayinTimeZone } from "../utils/timezone";


export async function applicationRoutes(app: FastifyInstance){

    /* 
    GET /api/applications

    returns a list of paginated applicatons with filters
    */
    app.get<{
        Querystring: {
            page?: string;
            limit?: string;
            status?: string;
            date?: string;
        };
    }>(
        "/",
        {preHandler: requireAuth},
        async (req, reply) => {
            
            const page = Math.max(1, parseInt(req.query.page ?? "1"));
            const limit = Math.min(50, parseInt(req.query.limit ?? "20"));
            const offset = (page - 1) * limit;

            let query = db
                .from("applications")
                .select("*", {count: "exact"})
                .eq("user_id", req.user!.userId)
                .order("applied_at", {ascending: false})
                .range(offset, offset + limit -1);

            if(req.query.status) {
                query = query.eq("status", req.query.status)
            }

            if(req.query.date) {
                query = query
                    .gte("applied_at", `${req.query.date}T00:00:00+00:0`)
                    .lte("applied_at", `${req.query.date}T23:59:59+00:00`);
            }

            const {data, count, error} = await query;

            if(error){
                return reply.status(500).send({error: "failed to fetch applications"});
            }

            return reply.send({
                applications: data ?? [],
                pagination: {
                    total: count ?? 0,
                    page,
                    limit,
                    total_pages: Math.ceil((count ?? 0) / limit),
                },
            });
        }
    );
}