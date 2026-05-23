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
import { refresh } from "next/cache";


interface UseApplicationsOptions {
    page?: number;
    limit?: number;
    status?: ApplicationStatus | "";
    date?: string;
}

export function useApplications(options: UseApplicationsOptions = {}){

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

   //update status which updates local cache before api responds
   async function updateStatus(
    id: string,
    status: ApplicationStatus
   ){

    await mutate(
        (current) => {
            if (!current) return current;
            return {
                ...current,
                applications: current.applications.map((app) => 
                    app.id === id ? {...app, status} : app),
            };
        },
        false   //skip immediate revalidation
    );

    const result = await api.patch<{application: Application}>(
        `/api/applications/${id}`,
        {status}
    );

    //revalidate whether success or failure
    mutate();
    
    return result;
   }

   //delete application: removes the application locally first for feedback
   async function deleteApplication(id: string) {
    await mutate(
        (current) => {
            if(!current) return current;

            return {
                ...current,
                applications: current.applications.filter(
                    (app) => app.id !== id
                ),
                pagination: {
                    ...current.pagination,
                    total: current.pagination.total - 1,
                },
            };
        },
        false
    );

    const result = await api.delete(
        `/api/applications/${id}`
    );

    mutate();

    return result;
   }

   return {
    applications: data?.applications ?? [],
    pagination: data?.pagination ?? null,

    isLoading,
    isError: !!error,

    addApplication,
    updateStatus,
    deleteApplication,

    refresh: () => mutate(),
   };
}

