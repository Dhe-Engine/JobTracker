"use client";

/*
this page shows the user's job application history

what this page does:
  - loads weekly and monthly history data from the backend
  - shows a 30-day heatmap calendar
  - displays monthly statistics like streaks and totals
  - shows the user's current and longest streak
  - renders a simple weekly bar chart using only css
  - shows loading skeletons while data is being fetched
*/

import { useWeeklyHistory, useMonthlyHistory } from "@/hooks/useHistory";
import HeatmapCalendar from "@/components/HeatmapCalender";
import StreakBadge from "@/components/StreakBadge";
import { TrendingUp, Calendar, Award } from "lucide-react";

/*
this component:
  - fetches weekly + monthly history data
  - handles loading states
  - renders all history sections on the page
*/
export default function HistoryPage() {

  // weekly history = this week's activity
  const { history: weekly, isLoading: wLoading } = useWeeklyHistory();

  // monthly history = last 30 days activity
  const { history: monthly, isLoading: mLoading } = useMonthlyHistory();

  // page is loading if either request is still loading
  const isLoading = wLoading || mLoading;

  // show loading placeholders while waiting for data
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-32 rounded-lg bg-gray-800" />
        <div className="h-48 rounded-2xl bg-gray-900" />
        <div className="h-64 rounded-2xl bg-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/*Page heading*/}
      <div>
        <h1 className="text-2xl font-bold text-white">History</h1>

        {/* Small explanation under the title */}
        <p className="mt-1 text-sm text-gray-400">
          Your application activity over the past 30 days
        </p>
      </div>

      {/* Monthly heatmap calendar */}

      {/* Only show this section if monthly data exists */}
      {monthly && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">

          {/* Section heading */}
          <div className="mb-5 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-white">30-day heatmap</h2>
          </div>

          {/* Heatmap component:
              brighter squares = more applications */}
          <HeatmapCalendar days={monthly.days} />
        </div>
      )}

      {/* Monthly statistics cards */}

      {monthly && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

          {/*
            Stats are stored in an array so the UI is easy to update later.
            Adding a new stat only needs one new object.
          */}
          {[
            {
              label: "Total applied",
              value: monthly.total_applied,
              colour: "text-white",
            },
            {
              label: "Days hit target",
              value: monthly.days_met_target,
              colour: "text-green-400",
            },
            {
              label: "Best week",
              value: monthly.best_week_total,
              colour: "text-amber-400",
            },
            {
              label: "Longest streak",
              value: `${monthly.longest_streak}d`,
              colour: "text-purple-400",
            },
          ].map(({ label, value, colour }) => (

            // Single stat card
            <div
              key={label}
              className="rounded-xl border border-gray-800 bg-gray-900 p-4"
            >
              {/* Big stat number */}
              <p className={`text-2xl font-bold tabular-nums ${colour}`}>
                {value}
              </p>

              {/* Small stat label */}
              <p className="mt-1 text-xs text-gray-500">
                {label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Streak section */}

      {monthly && (
        <div
          className="flex items-center justify-center rounded-2xl
                     border border-gray-800 bg-gray-900 py-10"
        >

          {/* Reusable streak component */}
          <StreakBadge
            current={monthly.current_streak}
            longest={monthly.longest_streak}
            size="lg"
          />
        </div>
      )}

      {/* Weekly bar chart */}

      {weekly && (
        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">

          {/* Chart header */}
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />

            <h2 className="font-semibold text-white">
              This week
            </h2>

            {/* Weekly summary */}
            <span className="ml-auto text-sm text-gray-500">
              {weekly.total_applied} applications ·{" "}
              {weekly.days_met_target}/7 days hit
            </span>
          </div>

          {/* ── Bar chart ── */}
          <div className="flex items-end gap-2 h-32">

            {/*
              Each day becomes one vertical bar.
              Taller bar = more progress toward the target.
            */}
            {weekly.days.map((day) => {

              /*
                Calculate bar height percentage.

                Example:
                  applied_count = 5
                  target = 10
                  height = 50%
              */
              const heightPct =
                day.target > 0
                  ? Math.min(100, (day.applied_count / day.target) * 100)
                  : 0;

              // Highlight the best day of the week
              const isBest = weekly.best_day?.date === day.date;

              return (
                <div
                  key={day.date}
                  className="flex flex-1 flex-col items-center gap-1"
                >

                  {/* Number shown above the bar */}
                  <span className="text-[10px] tabular-nums text-gray-500">
                    {day.applied_count}
                  </span>

                  {/* Bar container */}
                  <div className="relative w-full flex-1 flex items-end">

                    {/* Actual bar */}
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        day.met_target
                          ? "bg-green-500"   // green = goal hit
                          : isBest
                          ? "bg-amber-400"   // amber = best day
                          : "bg-gray-700"    // gray = below target
                      }`}

                      /*
                        Make sure bars are never completely invisible.
                        Minimum height = 4%
                      */
                      style={{
                        height: `${Math.max(4, heightPct)}%`,
                      }}
                    />
                  </div>

                  {/* Day label under the bar */}
                  <span className="text-[10px] text-gray-600">
                    {new Date(day.date + "T12:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "narrow" }
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ── Chart legend ── */}
          <div className="mt-4 flex items-center gap-4 text-[11px] text-gray-600">

            {/* Green explanation */}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
              Target met
            </span>

            {/* Amber explanation */}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
              Best day
            </span>

            {/* Gray explanation */}
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-gray-700" />
              Below target
            </span>
          </div>
        </div>
      )}

    </div>
  );
}