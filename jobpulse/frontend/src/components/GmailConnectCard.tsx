/*
This component lets the user connect or disconnect their Gmail account.

When Gmail is connected:
  - JobPulse can automatically detect job application emails
  - Applications get tracked without manual entry
This component:
  - Shows whether Gmail is connected
  - Starts the Google OAuth login flow
  - Lets the user disconnect Gmail
  - Shows loading and error states
  - Explains what Gmail permissions are used
*/

"use client";

import { useState } from "react";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2
} from "lucide-react";

import { api } from "@/app/lib/api/client";
import { useAuth } from "@/hooks/useAuth";


// ─────────────────────────────────────────────────────────────────────────────
// GMAIL CONNECT CARD COMPONENT
// Shows the Gmail connection status and controls.
//
// Example states:
//
// NOT CONNECTED
//   [ Connect Gmail ]
//
// CONNECTED
//   ✓ Gmail connected
//   [ Disconnect Gmail ]
// ─────────────────────────────────────────────────────────────────────────────
export default function GmailConnectCard() {

  // Current logged-in user data
  // Also gives us a refresh() function to re-fetch user info
  const { user, refresh } = useAuth();


  // Tracks whether the connect flow has started
  // Used to disable the connect button and show spinner
  const [isConnecting, setIsConnecting] = useState(false);


  // Tracks whether disconnect request is running
  // Used to disable disconnect button and show spinner
  const [isDisconnecting, setIsDisconnecting] = useState(false);


  // Stores error messages to show in the UI
  const [error, setError] = useState<string | null>(null);


  // ───────────────────────────────────────────────────────────────────────────
  // HANDLE CONNECT
  //
  // Starts the Google OAuth flow.
  //
  // What happens:
  //   1. User clicks "Connect Gmail"
  //   2. Browser redirects to backend
  //   3. Backend redirects to Google login
  //   4. User grants permission
  //   5. Google redirects back to backend
  //   6. Backend creates session + stores Gmail token
  //   7. User returns to dashboard
  // ───────────────────────────────────────────────────────────────────────────
  async function handleConnect() {

    // Show loading state
    setIsConnecting(true);

    // Clear old errors
    setError(null);

    // Redirect browser to backend OAuth endpoint
    // Backend handles the entire Google login flow
    window.location.href =
      `${process.env.NEXT_PUBLIC_API_URL}/api/auth/google`;
  }


  // ───────────────────────────────────────────────────────────────────────────
  // HANDLE DISCONNECT
  //
  // Disconnects Gmail from the account.
  //
  // After disconnecting:
  //   - New application emails stop being tracked
  //   - Existing tracked applications remain
  // ───────────────────────────────────────────────────────────────────────────
  async function handleDisconnect() {

    // Safety confirmation popup
    const confirmed = confirm(
      "Disconnect Gmail? New application emails won't be tracked."
    );

    // Stop if user clicked Cancel
    if (!confirmed) return;


    // Show loading state
    setIsDisconnecting(true);

    // Clear old errors
    setError(null);


    // Tell backend to disconnect Gmail
    const { error } = await api.post("/api/gmail/disconnect");


    // If backend returned an error
    if (error) {

      // Show error message
      setError(error.message);

    } else {

      // Re-fetch user data so UI updates immediately
      refresh();
    }


    // Stop loading state
    setIsDisconnecting(false);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // CONNECTION STATE
  //
  // Backend adds:
  //   gmail_connected: true | false
  //
  // to the authenticated user object.
  //
  // We use that boolean to decide which UI to show.
  // ───────────────────────────────────────────────────────────────────────────
  const isConnected = user?.gmail_connected === true;


  // ───────────────────────────────────────────────────────────────────────────
  // UI
  // Everything below is what appears on screen.
  // ───────────────────────────────────────────────────────────────────────────
  return (

    // Main card container
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">

      {/* Top section */}
      <div className="flex items-start gap-4">


        {/* ────────────────────────────────────────────────────────────────────
            GMAIL ICON
            Changes colour depending on connection state.
           ──────────────────────────────────────────────────────────────────── */}
        <div
          className={`flex h-12 w-12 flex-shrink-0 items-center justify-center
                      rounded-xl ${
                        isConnected
                          ? "bg-green-500/10"
                          : "bg-gray-800"
                      }`}
        >
          <Mail
            className={`h-6 w-6 ${
              isConnected
                ? "text-green-400"
                : "text-gray-500"
            }`}
          />
        </div>


        {/* ────────────────────────────────────────────────────────────────────
            TEXT CONTENT
           ──────────────────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">


          {/* Header row */}
          <div className="flex items-center gap-2">

            {/* Card title */}
            <h3 className="font-semibold text-white">
              Gmail integration
            </h3>


            {/* Status icon */}
            {isConnected ? (

              // Green check when connected
              <CheckCircle2 className="h-4 w-4 text-green-400" />

            ) : (

              // Grey warning icon when disconnected
              <AlertCircle className="h-4 w-4 text-gray-500" />
            )}
          </div>


          {/* Main description */}
          <p className="mt-1 text-sm text-gray-400">

            {isConnected
              ? "Connected — application emails are being tracked automatically."
              : "Connect Gmail to automatically detect job application confirmation emails."}
          </p>


          {/* Privacy explanation */}
          <p className="mt-2 text-xs text-gray-600">
            Read-only access · email subject and sender only · never the body
          </p>


          {/* Error message */}
          {error && (
            <p className="mt-2 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>


      {/* ──────────────────────────────────────────────────────────────────────
          ACTION BUTTONS
          Shows different buttons depending on connection state.
         ────────────────────────────────────────────────────────────────────── */}
      <div className="mt-5">

        {/* ── CONNECTED STATE ── */}
        {isConnected ? (

          <button

            // Disconnect Gmail
            onClick={handleDisconnect}

            // Disable while disconnecting
            disabled={isDisconnecting}

            className="rounded-lg border border-gray-700 px-4 py-2 text-sm
                       font-medium text-gray-400 transition hover:border-red-800
                       hover:text-red-400 disabled:cursor-not-allowed
                       disabled:opacity-50"
          >

            {/* Show spinner while disconnecting */}
            {isDisconnecting ? (

              <Loader2 className="h-4 w-4 animate-spin" />

            ) : (

              "Disconnect Gmail"
            )}
          </button>

        ) : (

          // ── DISCONNECTED STATE ──
          <button

            // Start OAuth flow
            onClick={handleConnect}

            // Disable while redirecting
            disabled={isConnecting}

            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5
                       text-sm font-semibold text-gray-900 transition
                       hover:bg-gray-100 disabled:cursor-not-allowed
                       disabled:opacity-50"
          >

            {/* Loading spinner or Gmail icon */}
            {isConnecting ? (

              <Loader2 className="h-4 w-4 animate-spin text-gray-600" />

            ) : (

              <Mail className="h-4 w-4" />
            )}

            Connect Gmail
          </button>
        )}
      </div>
    </div>
  );
}