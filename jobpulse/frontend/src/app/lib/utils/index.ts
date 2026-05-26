/*
what this file does:
    - provides reusable formatting helpers
    - centralize tailwind class merging
    - formats dates and relative timestamps
    - maps application states to ui style
    - contains reusable progress + heatmap activities
*/


import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";
import {formatDistanceToNow, format,parseISO,} from "date-fns";
import type { ApplicationStatus, HeatmapIntensity } from "../types";

//merge tailwind class
export function cn(...inputs: ClassValue[]): string{
    return twMerge(clsx(inputs));
}

//date formatting section
//i.e. "2026-03-14T10:30:00Z" → "Mar 14, 2025"
export function formatDate(isoString: string): string {

    try{
        return format(parseISO(isoString), "MMM d, yyyy");
    }
    catch{
        return "unknown date";
    }
}

//"2026-03-14T10:30:00Z" → "2 hours ago" / "3 days ago"
export function timeAgo(isoString: string): string{

    try{
        return formatDistanceToNow(parseISO(isoString), {addSuffix: true});
    }
    catch{
        return "Unknown";
    }
}

//"2025-03-14" → "Fri, Mar 14"  (for heatmap tooltip)
export function formatDayLabel(dateStr: string): string {

    try{
        return format(parseISO(dateStr), "EEE, MMM d");
    }
    catch{
        return dateStr;
    }
}

//status helper
export function getStatusClasses(status: ApplicationStatus): string {

    const map: Record<ApplicationStatus, string> = {
        applied: "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300",
        interview: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300",
        offer: "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300",
        rejected: "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300",
    };
    return map[status] ?? map.applied;
}

//label for each status
export function getStatusLabel(status: ApplicationStatus): string {

    const labels: Record<ApplicationStatus, string> = {
        applied: "Applied",
        interview: "Interview",
        offer: "Offer",
        rejected: "Rejected",
    };
    return labels[status] ?? "Applied";
}

//progress helper to display color based on percentage completion
export function getProgressColour(progressPct: number): string {

    if(progressPct >= 100) return "#22c55e";
    if(progressPct >= 50) return "#f59e0b";
    if(progressPct >= 25) return "#f97316";

    return "#ef4444"; 
}

//set number to minimum and maximum range
export function clamp(value:number, min: number,max: number): number{
    return Math.min(Math.max(value, min), max);
}

//heatmap helpers to return background color for heatmap intensity 
export function getHeatmapClass(intensity: HeatmapIntensity): string {

    const map: Record<HeatmapIntensity, string> = {
        0: "bg-gray-100 dark:bg-gray-800",
        1: "bg-green-200 dark:bg-green-900",
        2: "bg-green-400 dark:bg-green-700",
        3: "bg-green-500 dark:bg-green-600",
        4: "bg-green-600 dark:bg-green-500",
    };
    return map[intensity] ?? map[0];
}