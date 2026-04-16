import { db } from "../db/client";
import { config } from "../core/config";
import { getTodayinTimeZone,getYesterdayInTimeZone } from "../utils/timezone";
import type { GoalSummary,PeriodType,SetGoalInput } from "../models/goal.model";

/*
goalService

 purpose:
    - create and manage user goals
    - set targets
    - track progress
 */


export async function setGoal(

    //set new goal for user
    userId: string,
    input: SetGoalInput
): Promise<void> {


    //step 1: validate target range
    if (input.target < 1 || input.target > 500){
        throw new Error("target should be between 1-500");
    }

    //step 2:deactivate existing active goal
    const {error:deactivateError} = await db
        .from("goals")
        .update({active: false})
        .eq("user_id", userId)
        .eq("active", true);

    if (deactivateError) {
        throw new Error(`failed to deactivate old goals: ${deactivateError.message}`)
    }

    //step 3: insert new goal with default carryover 
    const {error:insertError} = await db.from ("goals").insert({
        
        user_id: userId,
        period_type: input.period_type,
        target: input.target,
        carryover: 0,
        effective_target: input.target,
        active: true
    });

    if (insertError){
        throw new Error(`failed to create goal: ${insertError?.message}`)
    }
}

export async function getActiveGoal(userId: string) {
    /*
    retrieves the current active goal for a user

    returns:
        - goal object or null
    */

    const { data: goal, error } = await db
        .from("goals")
        .select("*")
        .eq("user_id",userId)
        .eq("active", true)
        .single();

    //handle no rows 
    if (error) {
        if (error.code === "PGRST116"){
            return null;
        }
        throw new Error(`failed to fetch goal: ${error.message}`);
    } 

    return goal
}

export async function computeEffectiveTarget(
    userId: string
):Promise<GoalSummary | null> {

    /**
    calculate the user target for the current day

    responsibilities:
        - fetch timezone
        - fetch active goal
        - calculate carryover from previous day

    return: goalsummary or null
     */

    //get timezone
    const {data: user, error: userError} = await db
        .from("users")
        .select("timezone")
        .eq("id",userId)
        .single();

    if(userError || !user){
        throw new Error("user not found");
    }

    //retrieve active goal
    const goal = await getActiveGoal(userId);
    if (!goal) return null;

    //get the previous day summary
    const yesterday = getYesterdayInTimeZone(user.timezone)

    const {data: yesterdaySummary} = await db
        .from("daily_summaries")
        .select("applied_count, target, met_target")
        .eq("user_id", userId)
        .eq("date", yesterday)
        .single();

    //calculate carryover
    let carryover = 0;

    if (yesterdaySummary && !yesterdaySummary.met_target){

        const rawMissed = yesterdaySummary.target - yesterdaySummary.applied_count;

        //apply carryover
        const maxCarryover = goal.target * config.rules.carryoverCapMultiplier;

        carryover = Math.min(Math.max(0, rawMissed), maxCarryover);

    }

    //calculate effective target
    const effectiveTarget = goal.target + carryover;

    return {
        base_target: goal.target,
        carryover,
        effective_target: effectiveTarget,
        period_type: goal.period_type as PeriodType,
    };
}


export async function applyCarryover(
    /**
    updates the goal with carryover for the next day

    responsibilities:
        - check if user met current target
        - calculate carryover if target was missed
        - update goal with carryover
    */
   userId: string,
   todayApplied: number,
   todayTarget: number
): Promise<void> {

    const goal = await getActiveGoal(userId);
    if (!goal) return;

    //check if target was met
    const metTarget = todayApplied >= todayTarget;

    let tomorrowCarryover = 0;

    //calculate carryover when missed
    if (!metTarget) {

        const missed = todayTarget - todayApplied;
        const maxCarryover = goal.target * config.rules.carryoverCapMultiplier;

        tomorrowCarryover = Math.min(Math.max(0, missed), maxCarryover);
    }

    //calculate tomorrow target
    const tomorrowEffectiveTarget = goal.target + tomorrowCarryover;

    //persist updated values
    const {error} = await db
        .from("goals")
        .update({
            carryover: tomorrowCarryover,
            effective_target: tomorrowEffectiveTarget,
        })
        .eq("id",goal.id);
    
    if (error) {
        throw new Error(`failed to apply carryover: ${error.message}`);
    }
}

export async function getTodayProgress(userId: string): Promise<number> {

    /*
    returns the number of application the user made
    */

    //get user time zone
    const { data: user } = await db
        .from("users")
        .select("timezone")
        .eq("id", userId)
        .single();

    if (!user) return 0;

    const today = getTodayinTimeZone(user.timezone);

    //count application within current day range
    const {count, error} = await db
        .from("applications")
        .select("id", {count: "exact", head: true})
        .eq("user_id", userId)
        .gte("applied_at", `${today}T00:00:00+00:00`)
        .lt("applied_at", `${today}T23:59:59+00:00`);

    if(error) return 0;

    return count ?? 0;
    
}
