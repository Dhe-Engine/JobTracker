/*
this ui components:
    - displays calendar style heatmap in the history page
    - each sequence represents a day
*/


"use client";

import { useState } from "react";
import { getHeatmapClass, formatDayLabel } from "@/lib/utils";
import type { DayEntry } from "@/lib/types";
import { cn } from "@/lib/utils";


// Props accepted by the HeatmapCalendar component
interface HeatmapCalendarProps {

  // Array of daily history data
  days: DayEntry[];

  // Whether month labels should appear
  showMonthLabels?: boolean;
}

// Main heatmap component
export default function HeatmapCalendar({
  days,
  showMonthLabels = true,
}: HeatmapCalendarProps) {

  // Stores the day currently being hovered, used for the tooltip popup
  const [hoveredDay, setHoveredDay] =
    useState<DayEntry | null>(null);

  // Stores the tooltip screen position
  const [tooltipPos, setTooltipPos] =
    useState({ x: 0, y: 0 });

  // Runs when the mouse enters a calendar square
  function handleMouseEnter(
    e: React.MouseEvent,
    day: DayEntry
  ) {

    // Get the square's position on screen
    const rect =
      (e.target as HTMLElement).getBoundingClientRect();

    // Save tooltip position
    setTooltipPos({
      x: rect.left,
      y: rect.top,
    });

    // Save the hovered day data
    setHoveredDay(day);
  }


  // Split the days array into groups of 7
  // Each group becomes one calendar row (one week)
  //
  // Example:
  // [1..30] becomes:
  // [
  //   [1..7],
  //   [8..14],
  //   [15..21],
  //   ...
  // ]
  const weeks: DayEntry[][] = [];

  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div className="relative">

      {/* 
        Day labels at the top
      */}
      <div className="mb-1 grid grid-cols-7 gap-1 px-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-center text-[10px] text-gray-600"
          >
            {d}
          </div>
        ))}
      </div>


      {/* Main heatmap grid */}
      <div className="flex flex-col gap-1">

        {/* One row per week */}
        {weeks.map((week, wi) => (

          <div
            key={wi}
            className="grid grid-cols-7 gap-1"
          >

            {/* One square per day */}
            {week.map((day) => (

              <div
                key={day.date}

                // Show tooltip when hovering
                onMouseEnter={(e) =>
                  handleMouseEnter(e, day)
                }

                // Hide tooltip when leaving
                onMouseLeave={() =>
                  setHoveredDay(null)
                }

                className={cn(

                  // Base square styles
                  "aspect-square w-full rounded-sm cursor-default transition-all",

                  // Hover outline
                  "hover:ring-2 hover:ring-white/20 hover:ring-offset-1 hover:ring-offset-gray-950",

                  // Background colour based on activity intensity
                  getHeatmapClass(day.intensity)
                )}

                // Accessibility label for screen readers
                aria-label={
                  `${formatDayLabel(day.date)}: ${day.applied_count} applications`
                }
              />
            ))}
          </div>
        ))}
      </div>


      {/* 
        Heatmap legend

        Shows what the colours mean
      */}
      <div className="mt-3 flex items-center justify-end gap-1.5">

        <span className="text-[10px] text-gray-600">
          Less
        </span>

        {/* Example colour squares */}
        {([0, 1, 2, 3, 4] as const).map((level) => (

          <div
            key={level}
            className={cn(
              "h-3 w-3 rounded-sm",
              getHeatmapClass(level)
            )}
          />
        ))}

        <span className="text-[10px] text-gray-600">
          More
        </span>
      </div>


      {/* 
        Tooltip popup

        Appears when hovering over a day square
      */}
      {hoveredDay && (

        <div
          className="pointer-events-none fixed z-50
                     -translate-x-1/2 -translate-y-full -mt-2
                     rounded-lg border border-gray-700 bg-gray-800
                     px-3 py-2 text-xs shadow-xl"

          // Position tooltip near the hovered square
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 8,
          }}
        >

          {/* Date */}
          <div className="font-medium text-white">
            {formatDayLabel(hoveredDay.date)}
          </div>

          {/* Application count */}
          <div className="mt-0.5 text-gray-400">

            {hoveredDay.applied_count} application
            {hoveredDay.applied_count !== 1 ? "s" : ""}

            {/* Show target only if one exists */}
            {hoveredDay.target > 0 && (
              <span className="ml-1">
                / {hoveredDay.target} target
              </span>
            )}
          </div>

          {/* Success message if goal was reached */}
          {hoveredDay.met_target && (
            <div className="mt-0.5 text-green-400">
              ✓ Target met
            </div>
          )}
        </div>
      )}
    </div>
  );
}