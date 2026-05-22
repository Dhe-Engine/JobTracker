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
    gmail_connected: boolean;
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

//dashboard
export interface DashboardToday{

    applied_count: number;
    effective_target: number;
    base_target: number;
    carryover: number;
    progress_pct: number;
    remaining: number;
}

export interface DashboardStreak{

    current: number;
    longest: number;
    shame_screen_pending: boolean;
}

export interface DashboardPayload{

    today: DashboardToday;
    streak: DashboardStreak;
    recent_applications: Pick<Application,
        "id" | "company" | "role" | "status" | "applied_at"
        >[];
        goal_set: boolean;
}

//history
export type HeatmapIntensity = 0 | 1 | 2 | 3 | 4;

export interface DayEntry {

    date: string;
    applied_count: number;
    target: number;
    met_target: boolean;
    streak_day: number;
    intensity: HeatmapIntensity;
}

export interface WeeklyHistory {

    days: DayEntry[];
    total_applied: number;
    days_met_target: number;
    best_day: DayEntry | null; 
}

export interface MonthlyHistory {

    days: DayEntry[];
    total_applied: number;
    days_met_target: number;
    current_streak: number;
    longest_streak: number;
    best_week_total: number;
}

//api response
export interface ApplicationResponse {

    applications: Application[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        total_pages: number;
    };
}

export interface TodayApplicationsResponse {

    applications: Application[];
    count: number;
    date: string;
}

//generic success message
export interface SuccessResponse {
    ok: boolean;
}

//error shape
export interface ErrorResponse {
    error: string;
}