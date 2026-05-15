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

