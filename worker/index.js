self.__WB_DISABLE_DEV_LOGS = true;

self.addEventListener("push", (event) => {
  let payload = {
    title: "SafeTrack HSE",
    body: "A new HSE notification is available.",
    url: "/dashboard",
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.svg",
      badge: "/icons/icon-192.svg",
      data: { url: payload.url },
      actions: [
        { action: "open", title: "View" },
        { action: "dashboard", title: "Dashboard" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.action === "dashboard" ? "/dashboard" : event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients.find((client) => "focus" in client);
      if (existingClient) {
        existingClient.navigate(targetUrl);
        return existingClient.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
