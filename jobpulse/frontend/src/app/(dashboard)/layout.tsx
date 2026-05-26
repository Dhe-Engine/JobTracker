/*
this file:
    - share layout for all authenticated dashboard pages
    - handles authentication protection, redirects logged out users
    - displays sidebar
*/


"use client";


import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    //redirect unauthenticated users back to landing page
    useEffect(() => {
        if (!isLoading && !isAuthenticated === false) {
            router.replace("/");
        }
    }, [isAuthenticated, isLoading, router]);

    //show nothing while checking authentication 
    if(isLoading){
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-gray-200" />
            </div>
        );
    }

    if(!isAuthenticated) return null;

    return(
        <div className="flex min-h-screen">
            <Sidebar />
            {/* Main content — offset by sidebar width on desktop */}
            <main className="flex-1 pb-20 md:pb-0 md:pl-64">
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                    {children}
                </div>
            </main>    
        </div>
    );
}