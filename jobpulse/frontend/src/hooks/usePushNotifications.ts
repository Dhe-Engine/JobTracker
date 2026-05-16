/*
this file handles:
    - browser notification permission requests
    - firebase messaging initialization
    - fcm token generation
    - backend token registration
    - push support/error state management
*/


import { useState, useCallback } from "react";
import { api } from "@/app/lib/api/client";

//prevent firebase from being initialized multiple times
let messaging: unknown = null;

// Lazily loads Firebase Messaging only when needed.
async function getFirebaseMessaging() {
  // Reuse existing instance if already initialised
  if (messaging) {
    return messaging;
  }

  // Running on the server — browser APIs unavailable
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const {
      initializeApp,
      getApps,
    } = await import("firebase/app");

    const {
      getMessaging,
      getToken,
    } = await import("firebase/messaging");

    // Initialise Firebase once globally
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey:
              process.env.NEXT_PUBLIC_FIREBASE_API_KEY,

            authDomain:
              process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,

            projectId:
              process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,

            messagingSenderId:
              process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,

            appId:
              process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          });

    messaging = getMessaging(app);

    return {
      messaging,
      getToken,
    };

  } catch (err) {
    console.error("Firebase init failed:", err);
    return null;
  }
}

export function usePushNotifications() {
  const [permission, setPermission] =
    useState<NotificationPermission>("default");

  const [isRegistering, setIsRegistering] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  // Full push notification setup flow:
  // 1. Request browser permission
  // 2. Generate FCM token
  // 3. Register token with backend
  const requestPermissionAndRegister =
    useCallback(async () => {
      setIsRegistering(true);
      setError(null);

      try {
        // Ask the browser for notification permission
        const result =
          await Notification.requestPermission();

        setPermission(result);

        if (result !== "granted") {
          setError("Notification permission denied");
          return false;
        }

        // Initialise Firebase Messaging
        const firebase =
          await getFirebaseMessaging();

        if (!firebase) {
          setError(
            "Push notifications not supported in this browser"
          );
          return false;
        }

        const {
          messaging: fbMessaging,
          getToken,
        } = firebase as {
          messaging: unknown;
          getToken: Function;
        };

        // Generate browser/device FCM token
        const fcmToken = await getToken(
          fbMessaging,
          {
            vapidKey:
              process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,

            serviceWorkerRegistration:
              await navigator.serviceWorker.ready,
          }
        );

        if (!fcmToken) {
          setError("Could not get push token");
          return false;
        }

        // Persist token on backend for future notifications
        const { error: apiError } =
          await api.post(
            "/api/notifications/register",
            { fcm_token: fcmToken }
          );

        if (apiError) {
          setError(apiError.message);
          return false;
        }

        return true;

      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to enable notifications";

        setError(message);

        return false;

      } finally {
        setIsRegistering(false);
      }
    }, []);

  return {
    permission,
    isRegistering,
    error,

    requestPermissionAndRegister,

    // Basic browser capability check
    isSupported:
      typeof window !== "undefined" &&
      "Notification" in window,
  };
}