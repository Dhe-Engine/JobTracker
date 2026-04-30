//this file is responsible for the dashboard response payload

import { db } from "../db/client";
import { computeEffectiveTarget, getTodayProgress } from "./goal.services";
import { getTodayinTimeZone } from "../utils/timezone";

//define the shape of the api
export interface DashboardPayload{

    today:{
        applied_count: number;
        effective_target: number;
        base_target: number;
        carry_over: number;
        progress_pct: number;
        remaining: number;
    };
    streak:{
        current: number;
        longest: number;
        shame_screen_pending: boolean;
    }
    recent_applications: Array<{
        id: string;
        company: string;
        role: string;
        status: string;
        applied_at: string;
    }>;
    goal_set: boolean;

}