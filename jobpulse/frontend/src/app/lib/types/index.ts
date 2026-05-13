/**
what this file does:
    - defines the frontend data shapes
    - mirror backend response payload
    - provides reusable shared interface across the app
    - keep the frontend and backend synchronized
 */


//user
export interface User{

    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    timezone: string;
    notifications_enabled: boolean;
    created_at: string;
}

//goal
export type PeriodType = "daily" | "weekly";

export interface GoalSummary {

    base_target: number;
    carryover: number;
    effective_target: number;
    period_type: PeriodType;
}

//application
export type ApplicationStatus = "applied" | "interview" | "offer" | "rejected";
export type ApplicationSource = "email_auto" | "manual";

export interface Application{

    id: string;
    user_id: string;
    company: string;
    role: string;
    status: ApplicationStatus;
    source: ApplicationSource;
    email_id: string | null;
    applied_at: string;
    created_at: string;
}
