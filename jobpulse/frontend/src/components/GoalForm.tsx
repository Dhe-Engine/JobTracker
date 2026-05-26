  /*
  this component create/update their goal

  user can:
      - choose daily or weekly
      - set targets
  */

  "use client";

  import { useState, useEffect } from "react";
  import { useGoal } from "@/hooks/useGoal";
  import type { PeriodType } from "@/app/lib/types";
  import { cn } from "@/app/lib/utils";


  //set period types
  const PERIOD_OPTIONS: {
    value: PeriodType;
    label: string;
  }[] = [
    { value: "daily",  label: "Daily"  },
    { value: "weekly", label: "Weekly" },
  ];


  // Display the full goal-setting form.
  export default function GoalForm() {

    // Custom hook that talks to the backend goal API
    const { goal, setGoal, isLoading } = useGoal();


    // Current target number
    const [target, setTarget] = useState(20);


    // Current selected goal period
    const [period, setPeriod] = useState<PeriodType>("daily");


    // Tracks whether the form is currently saving
    // Used to disable buttons and show loading text
    const [isSaving, setIsSaving] = useState(false);


    // Shows a temporary success message after saving
    const [success, setSuccess] = useState(false);


    // Stores validation or API error messages
    const [error, setError] = useState<string | null>(null);

    //form submission
    async function handleSubmit(e: React.FormEvent) {

      // Prevent normal browser form submission
      e.preventDefault();

      // Clear old messages
      setError(null);
      setSuccess(false);


      // Safety validation
      // Prevent impossible or silly numbers
      if (target < 1 || target > 500) {
        setError("Target must be between 1 and 500");
        return;
      }


      // Show loading state
      setIsSaving(true);

      // Send goal to backend
      const result = await setGoal(period, target);

      // Stop loading state
      setIsSaving(false);


      // If backend returned an error
      if (result.error) {

        // Show error message
        setError(result.error.message);

      } else {

        // Show success message
        setSuccess(true);

        // Hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      }
    }


    // ───────────────────────────────────────────────────────────────────────────
    // UI
    // Everything below is what the user sees on screen.
    // ───────────────────────────────────────────────────────────────────────────
    return (

      // Main form container
      <form onSubmit={handleSubmit} className="space-y-5">


        {/* ──────────────────────────────────────────────────────────────────────
            PERIOD TOGGLE
            Lets the user choose:
              - Daily goal
              - Weekly goal
          ────────────────────────────────────────────────────────────────────── */}
        <div>

          {/* Section label */}
          <label className="mb-2 block text-sm font-medium text-gray-300">
            Goal period
          </label>

          {/* Toggle container */}
          <div className="flex rounded-lg bg-gray-800 p-1">

            {/* Create one button for each period option */}
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <button
                key={value}

                // Prevent form submission
                type="button"

                // Change selected period
                onClick={() => setPeriod(value)}

                className={cn(

                  // Base button styles
                  "flex-1 rounded-md py-2 text-sm font-medium transition",

                  // Active vs inactive styles
                  period === value
                    ? "bg-gray-700 text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>


        {/* ──────────────────────────────────────────────────────────────────────
            TARGET NUMBER INPUT
            Lets the user choose how many applications
            they want to send.
          ────────────────────────────────────────────────────────────────────── */}
        <div>

          {/* Dynamic label changes based on period */}
          <label
            htmlFor="target"
            className="mb-2 block text-sm font-medium text-gray-300"
          >
            Applications target per{" "}
            {period === "daily" ? "day" : "week"}
          </label>

          {/* Input controls */}
          <div className="flex items-center gap-3">


            {/* ── DECREMENT BUTTON ──
                Reduces target by 1
                Never goes below 1
            */}
            <button
              aria-label="Decrease target"
              type="button"

              onClick={() =>
                setTarget((t) => Math.max(1, t - 1))
              }

              className="flex h-10 w-10 items-center justify-center rounded-lg
                        bg-gray-800 text-gray-400 transition hover:bg-gray-700
                        hover:text-white text-xl font-bold"
            >
              −
            </button>


            {/* ── NUMBER INPUT ── */}
            <input
              id="target"
              type="number"

              // Minimum allowed value
              min={1}

              // Maximum allowed value
              max={500}

              // Current value
              value={target}

              // Update state when user types
              onChange={(e) => { 
                const value = Number(e.target.value);

                if (Number.isNaN(value)){
                  return;
                }

                setTarget(value);
              }}

              className="w-24 rounded-lg border border-gray-700 bg-gray-800
                        px-3 py-2 text-center text-xl font-bold text-white
                        focus:border-amber-500 focus:outline-none"
            />


            {/* ── INCREMENT BUTTON ──
                Increases target by 1
                Never goes above 500
            */}
            <button
              aria-label="Increase target"
              type="button"

              onClick={() =>
                setTarget((t) => Math.min(500, t + 1))
              }

              className="flex h-10 w-10 items-center justify-center rounded-lg
                        bg-gray-800 text-gray-400 transition hover:bg-gray-700
                        hover:text-white text-xl font-bold"
            >
              +
            </button>
          </div>


          {/* Small helper text */}
          <p className="mt-2 text-xs text-gray-500">
              {
                period === "daily"
                  ? "Recommended: 15–30 applications per day"
                  : "Recommended: 75–150 applications per week"
              }
          </p>
        </div>


        {/* ──────────────────────────────────────────────────────────────────────
            FEEDBACK MESSAGES
            Shows validation or success messages.
          ────────────────────────────────────────────────────────────────────── */}

        {/* Error message */}
        {error && (
          <p className="text-sm text-red-400">
            {error}
          </p>
        )}

        {/* Success message */}
        {success && (
          <p className="text-sm text-green-400">
            ✓ Goal saved successfully
          </p>
        )}


        {/* ──────────────────────────────────────────────────────────────────────
            SUBMIT BUTTON
            Saves the goal.
          ────────────────────────────────────────────────────────────────────── */}
        <button
          type="submit"

          // Disable while saving/loading
          disabled={isSaving || isLoading}

          className="w-full rounded-xl bg-amber-400 py-3 text-sm font-bold
                    text-gray-900 transition hover:bg-amber-300
                    disabled:cursor-not-allowed disabled:opacity-60"
        >

          {/* Dynamic button text */}
          {isSaving
            ? "Saving..."
            : goal
            ? "Update goal"
            : "Set goal"}
        </button>
      </form>
    );
  }