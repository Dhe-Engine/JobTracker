/*
this file provides:
    - weekly application history
    - monthly heatmap history
    - shared swr loading/error handling
*/


import useSWR from "swr";
import { swrFetcher } from "@/app/lib/api/client";
import type { WeeklyHistory, MonthlyHistory } from "@/app/lib/types";


//fetch the last 30 days activities
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
