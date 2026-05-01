/*
this file is responsible for preparing user activity history

what it does:
  - create and configure fastify
  - register plugins and routes
  - start background workers + cron jobs
  - start the http server
*/


import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";

import { config } from "./core/config";
import { authRoutes } from "./routes/auth.routes";
import { goalRoutes } from "./routes/goals.routes";
import { gmailRoutes } from "./routes/gmail.routes";

import { emailScanWorker } from "./workers/email-scan.worker";
import { startDailySummaryCron } from "./workers/daily-summary.worker";
import { startNotificationCron } from "./workers/notification.worker";



//a single day activity
export interface DayEntry {
    date: string;
    applied_count: number;
    target: number;
    met_target: boolean;
    streak_day: number;

    //heatmap intensity (lowest-highest)
    intensity: 0 | 1 | 2 | 3 | 4; 
}

//summary of the last 7 days
export interface WeeklyHistory {
    days: DayEntry[];
    total_applied: number;
    days_met_target: number;
    best_day: DayEntry | null;
}

//summary of the last 30 days
export interface MonthlyHistory {
    days: DayEntry[];
    total_applied: number;
    days_met_target: number;
    current_streak: number;
    longest_streak: number;
    best_week_total: number;
}

//maps the applied target to heatmap intensity
function computeIntensity(
    appliedCount: number,
    target: number
): 0 | 1 | 2 | 3 | 4 {

    if(target === 0 || appliedCount === 0) return 0;;

    const ratio = appliedCount / target;

    if(ratio >= 1) return 4;
    if(ratio >= 0.5) return 3;
    if(ratio >= 0.25) return 2;
    return 1;
}

//generate a list of past days based on the number specified and format to 'yyyy-mm-dd'
function buildDateRange(timezone: string, days: number): string[] {
    const dates: string[] = [];

    const formatter = new Intl.DateTimeFormat("sv-SE",
        {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }
    );

    for(let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(formatter.format(d));
    }

    return dates;
}