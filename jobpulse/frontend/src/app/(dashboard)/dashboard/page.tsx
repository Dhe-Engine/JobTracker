/*
this ui component is the page when a user logins in

it:
    - loads dashboard statistics from backend
    - show current day application progress
    - displays user streak
*/
"use client";

import { useDashboard } from "@/hooks/useDashboard";
import ProgressRing from "@/components/ProgressRing";
import StreakBadge from "@/components/StreakBadge";
import ShameScreen from "@/components/ShameScreen";
import ApplicationRow from "@/components/ApplicationRow";
import { useApplications } from "@/hooks/useApplications";
import { TrendingUp, Target, AlertCircle } from "lucide-react";


export default function DashboardPage() {

    //load dashboard from backend
    const {
        dashboard,
        isLoading,
        isError,
        dismissShameScreen,
    } = useDashboard();

    //update application status
    const { updateStatus } = useApplications();

    //while data is loading, display placeholder
    if (isLoading) return <DashboardSkeleton />;

    //error message if dashboard data is missing
    if (isError || !dashboard) {
        return (
            <div className="flex flex-col items-center gap-3 pt-20 text-gray-500">
                <AlertCircle className="h-10 w-10" />

                <p>
                    Could not load dashboard. Is the server running?
                </p>
            </div>
        )
    }

    // Pull useful pieces out of the dashboard object, so the JSX below is easier to read.
    const {
        today,
        streak,
        recent_applications,
        goal_set,
    } = dashboard;

    return (
        <>
            {/* 
                If the backend says the user missed their goal yesterday,
                show a full-screen overlay that forces them to acknowledge it.
            */}

            {streak.shame_screen_pending && (
                <ShameScreen
                    today={today}
                    streak={streak}
                    onDismiss={dismissShameScreen}
                />
            )}

            {/* Main page content */}
            <div className="space-y-8">

                {/* PAGE HEADER */}
                <div>

                    {/* Main title */}
                    <h1 className="text-2xl font-bold text-white">
                        Dashboard
                    </h1>

                    {/* Small subtitle under the title */}
                    <p className="mt-1 text-sm text-gray-400">

                        {/* If the user has already set a goal,show today's progress */}
                        {goal_set
                            ? `${today.applied_count} of ${today.effective_target} applications today`

                            // Otherwise encourage them to set one
                            : "Set a goal to get started"}
                    </p>
                </div>

                {/* If the user has not set a goal yet, show a message encouraging them to do so.*/}
                {!goal_set && (
                    <div className="rounded-xl border border-amber-800/40 bg-amber-500/5 p-6 text-center">

                        {/* Warning icon */}
                        <Target className="mx-auto mb-3 h-10 w-10 text-amber-400" />

                        <p className="font-medium text-white">
                            No goal set yet
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                            Go to Settings to set your daily or weekly application target.
                        </p>
                    </div>
                )}

                {/* Only show this if the user already has a goal. */}
                {goal_set && (
                    <div className="grid gap-6 sm:grid-cols-3">

                        {/* ── Progress ring card ─────────────────────────────────────── */}
                        <div
                            className="flex flex-col items-center justify-center
                                        rounded-2xl border border-gray-800
                                        bg-gray-900 p-8 sm:col-span-2"
                        >

                            {/* Circular progress indicator */}
                            <ProgressRing
                                applied={today.applied_count}
                                target={today.effective_target}
                                progressPct={today.progress_pct}
                                size={180}
                            />

                            {/* If the user missed applications yesterday, show how many were carried over */}
                            {today.carryover > 0 && (
                                <p className="mt-4 text-center text-xs text-amber-400">
                                    Includes {today.carryover} carried over from yesterday
                                </p>
                            )}

                            {/* Show how many applications are left to complete */}
                            {today.remaining > 0 && (
                                <p className="mt-2 text-sm text-gray-400">

                                    <span className="font-semibold text-white">
                                        {today.remaining}
                                    </span>{" "}

                                    more to hit today's target
                                </p>
                            )}
                        </div>

                        {/* ── Streak card ───────────────────────────────────────────── */}
                        <div
                            className="flex flex-col items-center justify-center
                                        rounded-2xl border border-gray-800
                                        bg-gray-900 p-8"
                        >

                            {/* Fire streak display */}
                            <StreakBadge
                                current={streak.current}
                                longest={streak.longest}
                                size="lg"
                            />
                        </div>
                    </div>
                )}

                {/* Small stat boxes showing important numbers at a glance.*/}
                {goal_set && (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                        {[
                            {
                                label: "Applied today",
                                value: today.applied_count,
                                colour: "text-white",
                            },
                            {
                                label: "Target",
                                value: today.effective_target,
                                colour: "text-amber-400",
                            },
                            {
                                label: "Remaining",
                                value: today.remaining,
                                colour: "text-red-400",
                            },
                            {
                                label: "Progress",
                                value: `${today.progress_pct}%`,
                                colour: "text-green-400",
                            },
                        ].map(({ label, value, colour }) => (

                            // One statistics card
                            <div
                                key={label}
                                className="rounded-xl border border-gray-800 bg-gray-900 p-4"
                            >

                                {/* Big number */}
                                <p className={`text-2xl font-bold tabular-nums ${colour}`}>
                                    {value}
                                </p>

                                {/* Small label under the number */}
                                <p className="mt-1 text-xs text-gray-500">
                                    {label}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Shows the latest job applications the user added.*/}
                {recent_applications.length > 0 && (
                    <div>

                        {/* Section header */}
                        <div className="mb-4 flex items-center justify-between">

                            <h2 className="font-semibold text-white">
                                Recent applications
                            </h2>

                            {/* Link to full applications page */}
                            <a
                                href="/applications"
                                className="text-sm text-gray-400 hover:text-white transition"
                            >
                                View all →
                            </a>
                        </div>

                        {/* List of recent applications */}
                        <div className="space-y-2">

                            {recent_applications.map((app) => (

                                // Single application row
                                <ApplicationRow
                                    key={app.id}

                                    // The dashboard version only contains partial application data.
                                    // "as any" temporarily tells TypeScript to trust us.
                                    application={app as any}

                                    // Allow status updates directly from dashboard
                                    onStatusChange={updateStatus}

                                    // Delete button is hidden on dashboard,
                                    // so this empty function is never actually used.
                                    onDelete={async () => { }}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}

/**
Loading skeleton component.
 
This shows animated placeholder boxes while the real dashboard
data is still loading from the server.
*/

function DashboardSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">

            {/* Fake title bar */}
            <div className="h-8 w-48 rounded-lg bg-gray-800" />

            {/* Fake main cards */}
            <div className="grid gap-6 sm:grid-cols-3">

                <div className="h-64 rounded-2xl bg-gray-900 sm:col-span-2" />

                <div className="h-64 rounded-2xl bg-gray-900" />
            </div>

            {/* Fake small stat boxes */}
            <div className="grid grid-cols-4 gap-4">

                {[...Array(4)].map((_, i) => (

                    <div
                        key={i}
                        className="h-20 rounded-xl bg-gray-900"
                    />
                ))}
            </div>
        </div>
    );
}
