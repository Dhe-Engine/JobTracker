/*
this file:
    - displays current day progress indicator towards its target
*/

"use client";

import {useMemo} from "react";
import { getProgressColour, clamp } from "@/lib/utils";


interface ProgressRingProps {

    applied: number;
    target: number;
    progressPct: number;

    //optional sizing overrides
    size?: number;
    strokeWidth?: number;

    //pulse animation after reaching 100%
    celebrateOnComplete?: boolean;
}

export default function ProgressRing({
    applied,
    target,
    progressPct,
    size = 200,
    strokeWidth = 14,
    celebrateOnComplete = true,
}: ProgressRingProps) {

    //svg circle calculations from props
    const {radius, circumference, dashOffset, colour} = useMemo(() => {
        const radius = (size - strokeWidth)/2;
        const circumference = 2 * Math.PI * radius;

        //convert progress to a 0-1 ratio
        const pct = clamp(progressPct, 0, 100)/100;

        //control ring visibility
        const dashOffset = circumference - pct * circumference;

        return {
            radius,
            circumference,
            dashOffset,
            colour: getProgressColour(progressPct),
        };
    }, [size, strokeWidth, progressPct]);

    const isComplete = progressPct >= 100;
    const center = size/2;

    return(
        <div className="relative inline-flex items-center justify-center">
            <svg
                width={size}
                height={size}
                className={
                    isComplete && celebrateOnComplete ?
                    "animate-pulse-once" :
                    ""
                }
            >
                {/*background ring*/}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="1f2937"
                    strokeWidth={strokeWidth}
                />

                {/* Progress ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={colour}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    // Rotate so progress starts from the top
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{
                        transition:
                        "stroke-dashoffset 0.6s ease, stroke 0.4s ease",
                    }}
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isComplete ? (
                <>
                    <span className="text-4xl">🎯</span>

                    <span className="mt-1 text-sm font-medium text-green-400">
                    Goal hit!
                    </span>
                </>
                ) : (
                <>
                    <span className="text-4xl font-extrabold tabular-nums text-white">
                    {applied}
                    </span>

                    <span className="text-sm text-gray-400">
                    of {target}
                    </span>

                    <span
                    className="mt-1 text-xs font-medium"
                    style={{ color: getProgressColour(progressPct) }}
                    >
                    {progressPct}%
                    </span>
                </>
                )}
            </div>
        </div>
    );
}