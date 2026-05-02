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


    /**
     * GET /api/applications/today
     * 
     * returns current application based on the user's timezone
     */
    app.get(
        "/today",
        {preHandler: requireAuth},
        async (req, reply) => {
            const {data: user} = await db
                .from("users")
                .select("timezone")
                .eq("id", req.user!.userId)
                .single();

            const timezone = user?.timezone ?? "UTC";
            const today = getTodayinTimeZone(timezone);

            const {data, count} = await db
                .from("applications")
                .select("*", {count: "exact"})
                .eq("user_id", req.user!.userId)
                .gte("applied_at", `${today}T00:00:00+00:00`)
                .lte("applied_at", `${today}T23:59:59+00:00`)
                .order("applied_at", {ascending: false});

            return reply.send({
                applications: data ?? [],
                count: count ?? 0,
                date: today,
            });
        }
    );

    /**
     * POST /api/applications
     * 
     * manually add an application (for jobs applied outside of email)
     */
    app.post<{Body: {company: string; role: string; applied_at?: string}}>(
        "/",
        {preHandler: requireAuth},
        async (req, reply) => {
            const schema = z.object({
                company: z.string().min(1).max(200),
                role: z.string().min(1).max(200),
                applied_at: z.iso.datetime().optional(),
            });

            const input = schema.parse(req.body);

            const {data, error} = await db
                .from("applications")
                .insert({
                    user_id: req.user!.userId,
                    company: input.company,
                    role: input.role,
                    status: "applied",
                    source: "manual",
                    email_id: null,
                    applied_at: input.applied_at ?? new Date().toISOString(),
                })
                .select()
                .single();

                if(error) {
                    return reply.status(500).send({error: "failed to add application"});
                }

                return reply.status(201).send({application: data});
        }
    );

}