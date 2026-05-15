/*
Applications data hook.

Handles:
- paginated application fetching
- filtering by status/date
- optimistic UI updates for edits/deletes
- SWR cache revalidation
- shared loading + error state management
*/

import useSWR from "swr";
import { swrFetcher,api } from "@/app/lib/api/client";
import type { Application, ApplicationStatus, ApplicationResponse } from "@/app/lib/types";


interface UseApplicationsOptions {
    page?: number;
    limit?: number;
    status?: ApplicationStatus | "";
    date?: string;
}

export function useApplicationsOptions(options: UseApplicationsOptions = {}){

    const {
        page = 1,
        limit = 20,
        status = "",
        date = "",
    } = options;

    //build query params from active filters
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });

    if(status) params.set("status", status);
    if(date) params.set("date", date);

    const key = `/api/applications?${params.toString()}`;

    const {data, error, isLoading, mutate} = useSWR<ApplicationResponse>(
        key, swrFetcher, {
            //disable application list aggressive auto refresh
            revalidateOnFocus: false,
        }
    );

    /*
    to create application:
        - call the api
        - revalidates the swr cache for the ui to be in sync
        - return the result
    */
   async function addApplication(input: {
    company: string;
    role: string;
    applied_at?: string;
   }) {
    
    //call api
    const result = await api.post<{application: Application}>(
        "/api/applications",
        input
    );

    //stay in sync
    if(!result.error){
        mutate(); 
    }

    return result;
   }
}

