/*
defines the shape of summary data

what it represents: 
    - one summary record per user per day
    - written once at midnight
    - stores the user's daily performance
*/


//map to daily_summaries table in the db
export interface DailySummary {
    id: string;
    user_id: string;

    //date based on user local timezone
    date: string;

    //no of applications logged that day
    applied_count: number;

    //effective target for that day
    target: number;

    //if user met target
    met_target: boolean;

    //current streak count
    streak_day: number;

    //number of carryover
    carryover_to_next: number;
}

//input payload for creating daily summary before saving to database
export interface DailySummaryInput {

    userId: string;
    date: string;
    appliedCount: number;
    target: number;
    metTarget: boolean;
    streakDay: number;
    carryoverToNext: number;

}