import { db } from "../db/client";
import { config } from "../core/config";
import { getTodayinTimeZone,getYesterdayInTimeZone } from "../utils/timezone";
import type { GoalSummary,SetGoalInput } from "../models/goal.model";

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
        .eq("userId", userId)
        .eq("active", true);

    if (deactivateError) {
        throw new Error(`failed to deactivate old goals: ${deactivateError.message}`)
    }

    //step 3: insert new goal with default carryover 
    const {error:insertError} = await db.from ("goals").insert({
        
        userId: userId,
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

