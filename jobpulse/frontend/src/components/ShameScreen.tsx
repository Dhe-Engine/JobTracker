/**
 this ui component:
    - displays when a user miss a previous day target
    - user needs to acknowledge before continuation
    */


"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { DashboardStreak, DashboardToday } from "@/app/lib/types";

interface ShameScreenProps {

    //current day dashboard information
    today: DashboardToday

    //current streak info
    streak: DashboardStreak

    //remove modal from screen
    onDismiss: () => Promise<void>;
}

export default function ShameScreen({
    today,
    streak,
    onDismiss,
}: ShameScreenProps) {

    //prevent button from being clicked multiple times while dismiss request is running
    const [isDismissing, setIsDismissing] = useState(false);

    //carryover from previous day
    const missed = today.carryover;

    async function handleDismiss() {
        
        //disable button immediately
        setIsDismissing(true);

        await onDismiss;
    }

    return (
        //display shame screen on full screen
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center
                        bg-gray-950/95 backdrop-blur-sm px-4"
        >

            {/* Main modal card */}
            <div
                className="w-full max-w-md rounded-2xl border border-red-900/50
                            bg-gray-900 p-8 text-center shadow-2xl"
            >

                {/* Warning icon */}
                <div
                    className="mx-auto mb-6 flex h-20 w-20 items-center justify-center
                                rounded-full bg-red-500/10"
                >
                    <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>


                {/* Main title */}
                <h2 className="mb-2 text-2xl font-extrabold text-white">
                    You missed your target
                </h2>


                {/* Explanation text */}
                <p className="mb-8 text-gray-400 leading-relaxed">

                    Yesterday's goal was{" "}

                    <span className="font-semibold text-white">
                        {today.base_target}
                    </span>{" "}

                    applications. You fell short by{" "}

                    <span className="font-semibold text-red-400">
                        {missed}
                    </span>.

                    {/* 
                    Only show carryover text if something was missed
                    */}
                    {missed > 0 && (
                    <>
                        {" "}
                        That{" "}
                        {missed === 1
                        ? "application"
                        : `${missed} applications`}{" "}
                        carry{missed === 1 ? "s" : ""} over to today.
                    </>
                    )}
                </p>


                {/* Stats section */}
                <div className="mb-8 grid grid-cols-2 gap-4">

                    {/* Lost streak */}
                    <div className="rounded-xl bg-gray-800 p-4">
                        <div className="text-2xl font-bold text-red-400">
                            0
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                            Streak days lost
                        </div>
                    </div>

                    {/* Today's updated target */}
                    <div className="rounded-xl bg-gray-800 p-4">
                        <div className="text-2xl font-bold text-amber-400">
                            {today.effective_target}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                            Today's target
                        </div>
                    </div>
                </div>


                {/* 
                    Small motivational message

                    Changes depending on how badly the target was missed
                */}
                <p className="mb-8 text-sm italic text-gray-500">

                    {missed >= 15
                    ? "A rough day. Today is a new start — make it count."

                    : missed >= 8
                    ? "You were close. Today you close the gap."

                    : "Small miss. Easy to recover. Let's go."}
                </p>


                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}

                    // Prevent double-clicking while request is running
                    disabled={isDismissing}

                    className="w-full rounded-xl bg-red-500 py-4 text-base
                                font-bold text-white transition hover:bg-red-400
                                disabled:cursor-not-allowed disabled:opacity-60"
                >

                    {/* Show loading state while dismissing */}
                    {isDismissing
                    ? "..."
                    : "I accept — let's get to work"}
                </button>
            </div>
        </div>
    );
}