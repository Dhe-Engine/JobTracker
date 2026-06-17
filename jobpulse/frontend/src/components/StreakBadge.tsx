/*
this ui component displays the number of days the user met their target
*/

"use client";

import { cn } from "@/lib/utils";


//prop(inputs) the component accepts
interface StreakBadgeProps {
    current: number;
    longest: number;
    size?: "sm" | "md" | "lg";
    showLongest?: boolean;
}

//text size for badge size
const SIZE_CLASSES = {

    sm: {
        flame: "text-2xl",
        count: "text-xl font-bold",
        label: "text-xs",
    },

    md: {
        flame: "text-4xl",
        count: "text-3xl font-bold",
        label: "text-sm",
    },

    lg: {
        flame: "text-5xl",
        count: "text-4xl font-bold",
        label: "text-base",
    },
} as const;

export default function StreakBadge({
    current,
    longest,
    size = "md",
    showLongest = true,
}: StreakBadgeProps) {

    //display flame if current streak > 0
    const isActive = current > 0;

    //retrieve the tailwind class for the selected size
    const classes = SIZE_CLASSES[size];

    return (
        <div className="flex flex-col items-center gap-1">

            {/* 
                Flame emoji

                - Bright and glowing when streak is active
                - Grey and faded when streak is broken
            */}
            <span
                className={cn(
                classes.flame,
                "transition-all duration-300",

                isActive
                    ? "drop-shadow-[0_0_8px_rgba(251,146,60,0.6)]"
                    : "grayscale opacity-30"
                )}
                role="img"

                // Screen reader accessibility label
                aria-label={
                isActive
                    ? "Active streak"
                    : "No active streak"
                }
            >
                🔥
            </span>

            {/* 
            Current streak number

            Example:
            7
            means 7 days in a row
            */}
            <span
                className={cn(
                    classes.count,
                    isActive
                    ? "text-white"
                    : "text-gray-600"
                )}
                >
                {current}
            </span>

            {/* Small label below the number */}
            <span className={cn(classes.label, "text-gray-400")}>
                day streak
            </span>

            {/* 
            Best streak ever achieved

            Only show it if:
            - showLongest = true
            - longest streak is greater than 0
            */}
            {showLongest && longest > 0 && (
                <span className="text-xs text-gray-600">
                    Best: {longest} {longest === 1 ? "day" : "days"}
                </span>
            )}
        </div>
    );
}