/*
this file handles:
    - fetching the authenticated user
    - logout flow
    - auth cache management
    - shared loading/auth state handling
*/


import useSWR from "swr";
import { swrFetcher,api } from "@/lib/api/client";
import type { User } from "@/lib/types";


// Response shape from GET /api/auth/me
interface AuthResponse {
    user: User;
}


export function useAuth() {
    const {data, error, isLoading, mutate} = useSWR<AuthResponse>(
        "/api/auth/me",
        swrFetcher,
        {
            //401 means unauthenticated
            shouldRetryOnError: false,

            //auth rarely change, so focus revalidation is unnecessary
            revalidateOnFocus: false,
            dedupingInterval: 5000,
            revalidateOnReconnect: false,
        }
    );

    //end current session and clear cache auth state
    async function logout() {
        await api.post("/api/auth/logout");

        //remove cached user
        mutate(undefined, false);

        //redirect to landing page
        window.location.href = "/";
    }

    return {
        user: data?.user ?? null,

        isAuthenticated: !!data?.user && !error,

        isLoading,

        isDefinitelyLoggedOut:
            !isLoading &&
            !data?.user &&
            error?.message !== undefined &&
            !error.message.includes("Network error"),

        logout,

        refresh: () => mutate(),
    };
}