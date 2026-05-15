/*
this file is the bridge between components and api
keeping the ui in sync
fetching dashboard data with swr
*/

import useSWR from "swr";
import { swrFetcher, api } from "@/app/lib/api/client";
import type { DashboardPayload } from "@/app/lib/types";

//shared swr behavior for all dashboard requests
const DASHBOARD_CONFIG = {
    refreshInterval: 60_000, //60s
    revalidateOnFocus: true, //refetch swtiched back to this tab
    dedupingInterval: 10_000 //prevent duplicate request within 10s
} as const;

export function useDashboard(){

    const {data, error, isLoading, mutate} = useSWR<DashboardPayload>(
        "/api/dashboard",
        swrFetcher,
        DASHBOARD_CONFIG
    );

    //hides the shame screen immediately and sync with server
    async function dismissShameScreen(){

        await mutate(
            (current) => 
                current
                    ? {
                        ...current,
                        streak: {
                            ...current.streak,
                            shame_screen_pending: false,
                        },
                    }
                : current,
            false
        );

        //persist the change on the server
        const {error} = await api.post("/api/dashboard/dismiss-shame");

        //refetch authorative state if the request succedded
        if(!error){
            mutate();
        }
    } 

    return {
        dashboard: data ?? null,
        isLoading,
        isError: !!error,
        errorMessage: error?.message ?? null,
        dismissShameScreen,
        refresh:() => mutate(),
    };
}