/*
this file provides:
    - weekly application history
    - monthly heatmap history
    - shared swr loading/error handling
*/


import useSWR from "swr";
import { swrFetcher } from "@/lib/api/client";
import type { WeeklyHistory, MonthlyHistory } from "@/lib/types";


//fetch the last 7 days activities
export function useWeeklyHistory(){

    const {data, error, isLoading} = useSWR<WeeklyHistory>(
        "/api/history/weekly",
        swrFetcher,
        {revalidateOnFocus: false}
    );

    return {
        history: data ?? null,
        isLoading,
        isError: !!error,
    };
}

//fetch the last 30 days heatmap, streak data
export function useMonthlyHistory(){

    const {data, error, isLoading} = useSWR<MonthlyHistory>(
        "/api/history/monthly",
        swrFetcher,
        {
            revalidateOnFocus: false,
        }
    );

    return {
        history: data ?? null,
        isLoading,
        isError: !!error,
    };
}
