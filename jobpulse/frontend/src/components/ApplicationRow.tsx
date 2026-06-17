/*
this ui component:
    - display a single job application with company info
    - update/delete application status
*/

"use client";

import { useState } from "react";
import { Trash2, Building2 } from "lucide-react";
import { cn, getStatusClasses, getStatusLabel, timeAgo } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/types";


//store all applicatino status
const ALL_STATUSES: ApplicationStatus[] = [
  "applied",
  "interview",
  "offer",
  "rejected",
];


/* 
 COMPONENT PROPS
 These are the pieces of information the parent gives this component.
*/ 
interface ApplicationRowProps {

  //actual job application data to show on screen
  application: Application;

  // Function to run when the user changes the status dropdown
  // Example:
  // Applied -> Interview
  onStatusChange: (
    id: string,
    status: ApplicationStatus
  ) => Promise<unknown>;

  // Function to run when the delete button is pressed
  onDelete: (id: string) => Promise<unknown>;

  // Optional flag that disables all buttons and inputs
  // Useful while loading or saving
  disabled?: boolean;
}


// ─────────────────────────────────────────────────────────────────────────────
// APPLICATION ROW COMPONENT
// Shows ONE job application.
//
// Example:
// Google — Frontend Engineer
// Applied 2 hours ago
// [Status dropdown]
// [Delete button]
// ─────────────────────────────────────────────────────────────────────────────
export default function ApplicationRow({
  application,
  onStatusChange,
  onDelete,
  disabled = false,
}: ApplicationRowProps) {

  // Tracks whether the status is currently being updated
  // Used to disable the dropdown while saving
  const [isUpdating, setIsUpdating] = useState(false);

  // Tracks whether the row is being deleted
  // Used to fade out the row while deleting
  const [isDeleting, setIsDeleting] = useState(false);


  // ───────────────────────────────────────────────────────────────────────────
  // HANDLE STATUS CHANGE
  //
  // Runs when the user picks a different option
  // from the dropdown.
  //
  // Example:
  // Applied -> Interview
  // ───────────────────────────────────────────────────────────────────────────
  async function handleStatusChange(
    e: React.ChangeEvent<HTMLSelectElement>
  ) {

    // Get the newly selected status from the dropdown
    const newStatus = e.target.value as ApplicationStatus;

    // Show loading state
    setIsUpdating(true);

    // Tell the parent component to update the application
    await onStatusChange(application.id, newStatus);

    // Stop loading state
    setIsUpdating(false);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // HANDLE DELETE
  //
  // Runs when the trash button is clicked.
  //
  // First asks the user:
  // "Are you sure?"
  //
  // This prevents accidental deletion.
  // ───────────────────────────────────────────────────────────────────────────
  async function handleDelete() {

    // Browser confirmation popup
    const confirmed = confirm(
      `Remove ${application.company} — ${application.role}?`
    );

    // If user pressed Cancel, stop immediately
    if (!confirmed) return;

    // Start deleting state
    setIsDeleting(true);

    // Tell the parent to delete this application
    await onDelete(application.id);

    // No need to set isDeleting(false)
    // because the whole row disappears after deletion
  }


  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // Everything below is what appears on screen.
  // ───────────────────────────────────────────────────────────────────────────
  return (

    // Main application row container
    <div
      className={cn(

        // Layout styles
        "flex items-center gap-4 rounded-xl border border-gray-800",

        // Background and hover styles
        "bg-gray-900 p-4 transition hover:border-gray-700",

        // When deleting:
        // - make it faded
        // - disable clicks
        isDeleting && "opacity-50 pointer-events-none"
      )}
    >

      {/* ──────────────────────────────────────────────────────────────────────
          COMPANY ICON
          Just a placeholder icon for now.
         ────────────────────────────────────────────────────────────────────── */}
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center
                   rounded-lg bg-gray-800"
      >
        <Building2 className="h-5 w-5 text-gray-500" />
      </div>


      {/* ──────────────────────────────────────────────────────────────────────
          COMPANY + ROLE INFO
         ────────────────────────────────────────────────────────────────────── */}
      <div className="min-w-0 flex-1">

        {/* Company name row */}
        <div className="flex items-center gap-2">

          {/* Company name */}
          <p className="truncate font-medium text-white">
            {application.company}
          </p>

          {/* Small badge for auto-detected applications */}
          {application.source === "email_auto" && (
            <span
              className="flex-shrink-0 rounded-full bg-blue-500/10
                         px-2 py-0.5 text-[10px] font-medium text-blue-400"
            >
              Auto
            </span>
          )}
        </div>

        {/* Job role/title */}
        <p className="truncate text-sm text-gray-400">
          {application.role}
        </p>

        {/* Relative time like:
            "2 hours ago"
            "3 days ago"
        */}
        <p className="mt-0.5 text-xs text-gray-600">
          {timeAgo(application.applied_at)}
        </p>
      </div>


      {/* ──────────────────────────────────────────────────────────────────────
          STATUS DROPDOWN
          Lets the user change the application status.
         ────────────────────────────────────────────────────────────────────── */}
      <select

        // Current selected value
        value={application.status}

        // Runs when changed
        onChange={handleStatusChange}

        // Disable while loading/saving
        disabled={disabled || isUpdating}

        className={cn(

          // Base styles
          "rounded-lg border-0 px-3 py-1.5 text-xs font-medium",

          // Interaction styles
          "cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-gray-600",

          // Colour changes based on current status
          getStatusClasses(application.status),

          // Disabled appearance
          (disabled || isUpdating) &&
            "cursor-not-allowed opacity-60"
        )}
      >

        {/* Create one dropdown option for every status */}
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {getStatusLabel(s)}
          </option>
        ))}
      </select>


      {/* ──────────────────────────────────────────────────────────────────────
          DELETE BUTTON
          Only shown for manually added applications.
          
          Auto-detected applications cannot be deleted.
         ────────────────────────────────────────────────────────────────────── */}
      {application.source === "manual" && (
        <button

          // Runs delete logic
          onClick={handleDelete}

          // Disable while deleting/loading
          disabled={disabled || isDeleting}

          className="flex-shrink-0 rounded-lg p-1.5 text-gray-600
                     transition hover:bg-red-500/10 hover:text-red-400
                     disabled:cursor-not-allowed disabled:opacity-40"

          // Accessibility label for screen readers
          aria-label="Delete application"
        >

          {/* Trash icon */}
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}