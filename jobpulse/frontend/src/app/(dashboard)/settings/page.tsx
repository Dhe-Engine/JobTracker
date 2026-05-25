/*
this page lets the user manage everything related to their account

what this page does:
  - lets the user set or update their application goal
  - lets the user connect or disconnect gmail
  - lets the user enable push notifications
  - shows account information like name and email
  - lets the user sign out
  - lets the user permanently delete their account
*/

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/app/lib/api/client";
import GoalForm from "@/components/GoalForm";
import GmailConnectCard from "@/components/GmailConnectCard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, Trash2, AlertTriangle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  /*
  useAuth gives us information about the logged-in user
  and helper functions like logout
  */
  const { user, logout } = useAuth();

  // Router lets us move the user to another page if needed
  const router = useRouter();

  /*
  Hook for browser push notifications

  permission:
    tells us whether notifications are allowed

  isRegistering:
    true while notification setup is happening

  requestPermissionAndRegister:
    asks the browser for permission and registers the device

  isSupported:
    checks whether the browser supports notifications
  */
  const {
    permission,
    isRegistering,
    requestPermissionAndRegister,
    isSupported,
  } = usePushNotifications();

  // True while account deletion request is running
  const [isDeleting, setIsDeleting] = useState(false);

  /*
  Stores what the user types into the confirmation box

  The user must type DELETE before account removal is allowed
  */
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Controls whether the delete confirmation section is visible
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /*
  Permanently deletes the user's account

  what happens here:
    1. checks that the user typed DELETE
    2. sends a delete request to the backend
    3. redirects the user to the landing page after success
  */
  async function handleDeleteAccount() {
    // Safety check — do nothing unless the user typed DELETE exactly
    if (deleteConfirm !== "DELETE") return;

    setIsDeleting(true);

    // Ask the backend to delete the account and all related data
    const { error } = await api.delete("/api/account");

    if (!error) {
      /*
      Account is gone now,
      so we send the user back to the public landing page
      */
      window.location.href = "/";
    }

    setIsDeleting(false);
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ───────────────── Header ───────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>

        {/* Small explanation text under the page title */}
        <p className="mt-1 text-sm text-gray-400">
          Manage your goal, integrations, and account
        </p>
      </div>

      {/* ───────────────── Goal settings section ───────────────── */}
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">

        {/* Section title */}
        <h2 className="mb-5 font-semibold text-white">
          Application goal
        </h2>

        {/* Form for setting daily or weekly goals */}
        <GoalForm />
      </section>

      {/* ───────────────── Gmail connection section ───────────────── */}
      <section>

        {/* Section title */}
        <h2 className="mb-4 font-semibold text-white">
          Gmail integration
        </h2>

        {/* Card that handles connect/disconnect actions */}
        <GmailConnectCard />
      </section>

      {/* ───────────────── Push notifications section ───────────────── */}
      {isSupported && (
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">

          <div className="flex items-start gap-4">

            {/* Notification icon box */}
            <div
              className={`flex h-12 w-12 flex-shrink-0 items-center justify-center
                          rounded-xl ${
                            permission === "granted"
                              ? "bg-green-500/10"
                              : "bg-gray-800"
                          }`}
            >
              <Bell
                className={`h-6 w-6 ${
                  permission === "granted"
                    ? "text-green-400"
                    : "text-gray-500"
                }`}
              />
            </div>

            <div className="flex-1">

              {/* Section title */}
              <h2 className="font-semibold text-white">
                Push notifications
              </h2>

              {/* Message changes depending on notification status */}
              <p className="mt-1 text-sm text-gray-400">
                {permission === "granted"
                  ? "Notifications are enabled. You'll receive goal reminders throughout the day."
                  : permission === "denied"
                  ? "Notifications are blocked. Enable them in your browser settings."
                  : "Allow push notifications to receive goal reminders."}
              </p>

              {/* Show enable button only if permission has not been decided yet */}
              {permission !== "granted" && permission !== "denied" && (
                <button
                  onClick={requestPermissionAndRegister}
                  disabled={isRegistering}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-amber-400
                             px-4 py-2 text-sm font-semibold text-gray-900
                             transition hover:bg-amber-300 disabled:opacity-60"
                >
                  {isRegistering ? (
                    // Spinner while notification setup is happening
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    // Bell icon before setup starts
                    <Bell className="h-4 w-4" />
                  )}

                  Enable notifications
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ───────────────── Account information section ───────────────── */}
      {user && (
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6">

          {/* Section title */}
          <h2 className="mb-4 font-semibold text-white">
            Account
          </h2>

          <div className="flex items-center gap-4">

            {/* User avatar image */}
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.name}
                className="h-12 w-12 rounded-full"
              />
            ) : (
              /*
              If the user has no profile image,
              show the first letter of their name instead
              */
              <div
                className="flex h-12 w-12 items-center justify-center
                           rounded-full bg-gray-700 text-lg font-bold"
              >
                {user.name.charAt(0)}
              </div>
            )}

            {/* User details */}
            <div>
              <p className="font-medium text-white">
                {user.name}
              </p>

              <p className="text-sm text-gray-400">
                {user.email}
              </p>

              <p className="text-xs text-gray-600">
                Timezone: {user.timezone}
              </p>
            </div>
          </div>

          {/* Sign out button */}
          <button
            onClick={logout}
            className="mt-5 rounded-lg border border-gray-700 px-4 py-2
                       text-sm font-medium text-gray-400 transition
                       hover:border-gray-500 hover:text-white"
          >
            Sign out
          </button>
        </section>
      )}

      {/* ───────────────── Danger zone section ───────────────── */}
      <section className="rounded-2xl border border-red-900/40 bg-gray-900 p-6">

        {/* Warning title row */}
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />

          <h2 className="font-semibold text-red-400">
            Danger zone
          </h2>
        </div>

        {/* Warning message */}
        <p className="mb-4 text-sm text-gray-400">
          Permanently delete your account and all data. This cannot be undone.
        </p>

        {/* First step — show delete button */}
        {!showDeleteModal ? (
          <button
            onClick={() => setShowDeleteModal(true)}
            className="rounded-lg border border-red-800 px-4 py-2 text-sm
                       font-medium text-red-400 transition hover:bg-red-500/10"
          >
            Delete account
          </button>
        ) : (
          /*
          Second step — show confirmation area

          This prevents accidental account deletion
          */
          <div className="space-y-3">

            {/* Instruction text */}
            <p className="text-sm font-medium text-red-400">
              Type DELETE to confirm permanent deletion:
            </p>

            {/* Confirmation input */}
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-red-800 bg-gray-800 px-3
                         py-2 text-sm font-mono text-red-400 placeholder-gray-700
                         focus:outline-none focus:border-red-600"
            />

            {/* Action buttons */}
            <div className="flex gap-3">

              {/* Permanent delete button */}
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== "DELETE" || isDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2
                           text-sm font-semibold text-white transition hover:bg-red-500
                           disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? (
                  // Spinner while deletion is happening
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  // Trash icon before deletion starts
                  <Trash2 className="h-4 w-4" />
                )}

                Delete permanently
              </button>

              {/* Cancel button */}
              <button
                onClick={() => {
                  /*
                  Hide the confirmation area
                  and clear the typed text
                  */
                  setShowDeleteModal(false);
                  setDeleteConfirm("");
                }}
                className="rounded-lg border border-gray-700 px-4 py-2 text-sm
                           text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}