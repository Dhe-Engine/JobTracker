/*
this file handles:
    - fetching the user's active goal
    - creating/updating goals
    - swr cache synchronization
    - shared loading + error state management
*/

import useSWR from "swr";
import { swrFetcher,api } from "@/app/lib/api/client";
import type { GoalSummary, PeriodType } from "@/app/lib/types";


//response shape from GET /api/goals/active
interface ActiveGoalResponse{
    goal: GoalSummary | null;
    message?: string,
}

export function useGoal() {
    const {data, error, isLoading, mutate} = useSWR<ActiveGoalResponse>(
        "/api/goals/active",
        swrFetcher
    );

    //create/update current goal
    async function setGoal(
        periodType: PeriodType,
        target: number
    ){
        const result = await api.post<{
            goal: GoalSummary;
        }>(
            "/api/goals",
            {
                period_type: periodType,
                target,
            },
        );

        //sync latest goal state after success
        if(!result.error){
            mutate();
        }

        return result;
    }

    return {
        goal: data?.goal ?? null,
        goalSet: !!data?.goal,

        isLoading,
        isError: !!error,

        setGoal,

        refresh: () => mutate(),
    };
}