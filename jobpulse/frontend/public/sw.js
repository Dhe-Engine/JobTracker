// Listen for push events from Firebase Cloud Messaging
self.addEventListener("push", function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: "JobPulse", body: event.data.text() } };
  }

  const title = payload.notification?.title ?? "JobPulse";
  const options = {
    body:    payload.notification?.body ?? "",
    icon:    "/icons/icon-192x192.png",
    badge:   "/icons/badge-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url ?? "/dashboard",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// When user taps the notification — navigate to the right page
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        // If the app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});