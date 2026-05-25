"use client";

/*
This page shows every job application the user has tracked.
It allows the user to:
  - View all applications
  - Filter applications by status
  - Add applications manually
  - Change application statuses
  - Delete manual applications
  - Move between pages using pagination
Think of this page as the user's "job application manager".
*/

import { useState } from "react";
import { Plus, Search, Filter, Loader2 } from "lucide-react";
import { useApplications } from "@/hooks/useApplications";
import ApplicationRow from "@/components/ApplicationRow";
import type { ApplicationStatus } from "@/app/lib/types";
import { cn } from "@/app/lib/utils"; 

/*
FILTER OPTIONS

These are the tabs shown above the applications list.
Example:
  All | Applied | Interview | Offer | Rejected
*/
const STATUS_FILTERS: {
  value: ApplicationStatus | "";
  label: string;
}[] = [
  { value: "",          label: "All" },
  { value: "applied",   label: "Applied" },
  { value: "interview", label: "Interview" },
  { value: "offer",     label: "Offer" },
  { value: "rejected",  label: "Rejected" },
];

/*
Automatically rendered when the user visits: /applications
*/
export default function ApplicationsPage() {

  // ───────────────────────────────────────────────────────────────────────────
  // LOCAL PAGE STATE
  // ───────────────────────────────────────────────────────────────────────────

  // Current pagination page
  // Example:
  //   1 = first page
  //   2 = second page
  const [page, setPage] = useState(1);

  // Which status filter is currently active
  //
  // Example:
  //   "applied"
  //   "offer"
  //   ""
  //
  // Empty string means:
  // "show all applications"
  const [statusFilter, setStatusFilter] =
    useState<ApplicationStatus | "">("");

  // Controls whether the manual add form is visible
  const [showAddForm, setShowAddForm] = useState(false);

  // ───────────────────────────────────────────────────────────────────────────
  // FORM STATE
  // ───────────────────────────────────────────────────────────────────────────
  // These store what the user types into the form inputs.

  // Company name input
  const [newCompany, setNewCompany] = useState("");

  // Job title / role input
  const [newRole, setNewRole] = useState("");

  // True while a new application is being saved
  const [isAdding, setIsAdding] = useState(false);

  // Error message shown if adding fails
  const [addError, setAddError] =
    useState<string | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // LOAD APPLICATION DATA
  // ───────────────────────────────────────────────────────────────────────────
  // This custom hook talks to the backend API
  // and gives us all application-related functionality.
  const {
    applications,
    pagination,
    isLoading,
    addApplication,
    updateStatus,
    deleteApplication,
  } = useApplications({

    // Current page number
    page,

    // Number of applications per page
    limit: 20,

    // Active status filter
    status: statusFilter,
  });

  /**
   * Handles manual application creation.
   *
   * Runs when the user submits the form.
   */
  async function handleAdd(e: React.FormEvent) {

    // Prevent the browser from refreshing the page
    e.preventDefault();

    // Remove empty spaces from both inputs.
    //
    // Example:
    //   " Google " → "Google"
    //
    // If either field becomes empty after trimming,
    // stop immediately.
    if (!newCompany.trim() || !newRole.trim()) {
      return;
    }

    // Show loading spinner on button
    setIsAdding(true);

    // Clear previous error message
    setAddError(null);

    // Send new application to backend
    const result = await addApplication({
      company: newCompany.trim(),
      role: newRole.trim(),
    });

    // If backend returned an error,
    // show it to the user.
    if (result.error) {

      setAddError(result.error.message);

    } else {

      // Clear the form inputs after success
      setNewCompany("");
      setNewRole("");

      // Hide the form after successful save
      setShowAddForm(false);
    }

    // Stop loading spinner
    setIsAdding(false);
  }

  return (
    <div className="space-y-6">

      {/* ──────────────────────────────────────────────────────────────────────
          PAGE HEADER
         ────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">

        {/* Left side: title + total count */}
        <div>

          <h1 className="text-2xl font-bold text-white">
            Applications
          </h1>

          {/* Only show total count once pagination data exists */}
          {pagination && (
            <p className="mt-1 text-sm text-gray-400">

              {/* Example:
                  "42 total"
              */}
              {pagination.total} total
            </p>
          )}
        </div>

        {/* Toggle manual add form */}
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg
                     bg-amber-400 px-4 py-2 text-sm
                     font-semibold text-gray-900
                     transition hover:bg-amber-300"
        >

          <Plus className="h-4 w-4" />

          Add manually
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          MANUAL ADD FORM
         ──────────────────────────────────────────────────────────────────────

         Only visible when showAddForm === true
      */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-amber-800/30
                     bg-gray-900 p-5 space-y-4"
        >

          {/* Form title */}
          <h3 className="font-medium text-white">
            Add application manually
          </h3>

          {/* Two-column input layout on larger screens */}
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Company name input */}
            <input
              type="text"
              placeholder="Company name"
              value={newCompany}

              // Update state whenever user types
              onChange={(e) => setNewCompany(e.target.value)}

              className="rounded-lg border border-gray-700
                         bg-gray-800 px-3 py-2.5 text-sm
                         text-white placeholder-gray-500
                         focus:border-amber-500 focus:outline-none"

              // Browser-level validation
              required
            />

            {/* Job role input */}
            <input
              type="text"
              placeholder="Job title / role"
              value={newRole}

              // Update state whenever user types
              onChange={(e) => setNewRole(e.target.value)}

              className="rounded-lg border border-gray-700
                         bg-gray-800 px-3 py-2.5 text-sm
                         text-white placeholder-gray-500
                         focus:border-amber-500 focus:outline-none"

              required
            />
          </div>

          {/* Error message */}
          {addError && (
            <p className="text-sm text-red-400">
              {addError}
            </p>
          )}

          {/* Form action buttons */}
          <div className="flex gap-3">

            {/* Submit button */}
            <button
              type="submit"
              disabled={isAdding}
              className="rounded-lg bg-amber-400 px-5 py-2
                         text-sm font-semibold text-gray-900
                         transition hover:bg-amber-300
                         disabled:cursor-not-allowed
                         disabled:opacity-60"
            >

              {/* Show spinner while saving */}
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Add"
              )}
            </button>

            {/* Cancel button */}
            <button
              type="button"

              // Hide form without saving
              onClick={() => setShowAddForm(false)}

              className="rounded-lg border border-gray-700
                         px-5 py-2 text-sm font-medium
                         text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          STATUS FILTER TABS
         ──────────────────────────────────────────────────────────────────────

         These let the user filter applications by status.
      */}
      <div className="flex gap-2 overflow-x-auto pb-1">

        {STATUS_FILTERS.map(({ value, label }) => (

          <button
            key={value}

            onClick={() => {

              // Change active filter
              setStatusFilter(value);

              // Return to first page whenever filter changes
              setPage(1);
            }}

            className={cn(
              "flex-shrink-0 rounded-lg px-3 py-1.5",
              "text-sm font-medium transition",

              // Active tab styling
              statusFilter === value
                ? "bg-gray-700 text-white"

                // Inactive tab styling
                : "text-gray-500 hover:text-gray-300"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          APPLICATION LIST AREA
         ──────────────────────────────────────────────────────────────────────

         This section has 3 possible states:
           1. Loading
           2. Empty
           3. Actual applications
      */}

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {isLoading ? (

        // Animated placeholder rows while data loads
        <div className="space-y-2">

          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-xl bg-gray-900"
            />
          ))}
        </div>

      ) : applications.length === 0 ? (

        // ── Empty state ────────────────────────────────────────────────────
        // Show message if no applications exist
        <div className="py-20 text-center text-gray-600">

          <Search className="mx-auto mb-3 h-10 w-10" />

          <p>No applications found</p>
        </div>

      ) : (

        // ── Actual application list ───────────────────────────────────────
        <div className="space-y-2">

          {applications.map((app) => (

            // One application row
            <ApplicationRow
              key={app.id}

              application={app}

              // Allow status updates
              onStatusChange={updateStatus}

              // Allow deletion
              onDelete={deleteApplication}
            />
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          PAGINATION
         ──────────────────────────────────────────────────────────────────────

         Only show pagination controls if there is more than one page.
      */}
      {pagination && pagination.total_pages > 1 && (

        <div className="flex items-center justify-center gap-3 pt-2">

          {/* Previous page button */}
          <button
            onClick={() =>

              // Never allow page number below 1
              setPage((p) => Math.max(1, p - 1))
            }

            // Disable button on first page
            disabled={page === 1}

            className="rounded-lg border border-gray-800
                       px-4 py-2 text-sm text-gray-400
                       transition hover:text-white
                       disabled:cursor-not-allowed
                       disabled:opacity-40"
          >
            Previous
          </button>

          {/* Current page info */}
          <span className="text-sm text-gray-500">

            {/* Example:
                Page 2 of 5
            */}
            Page {page} of {pagination.total_pages}
          </span>

          {/* Next page button */}
          <button
            onClick={() =>

              // Never allow page number past last page
              setPage((p) =>
                Math.min(pagination.total_pages, p + 1)
              )
            }

            // Disable button on final page
            disabled={page === pagination.total_pages}

            className="rounded-lg border border-gray-800
                       px-4 py-2 text-sm text-gray-400
                       transition hover:text-white
                       disabled:cursor-not-allowed
                       disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}