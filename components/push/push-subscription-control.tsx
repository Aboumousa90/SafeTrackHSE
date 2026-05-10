"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData.split("").map((char) => char.charCodeAt(0)));
}

export function PushSubscriptionControl() {
  const { t } = useLanguage();
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState(t.shell.pushUnavailable);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const hasSupport = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(hasSupport);
    if (!hasSupport) return;
    setStatus(Notification.permission === "granted" ? t.shell.pushEnabled : t.shell.enablePush);
  }, [t.shell.enablePush, t.shell.pushEnabled]);

  async function subscribe() {
    if (!supported || subscribing) return;
    setSubscribing(true);

    try {
      const keyResponse = await fetch("/api/push/public-key");
      const keyResult = (await keyResponse.json()) as { publicKey?: string; configured: boolean };
      if (!keyResult.configured || !keyResult.publicKey) {
        setStatus(t.shell.pushMissing);
        setSubscribing(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(t.shell.pushBlocked);
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey),
      });
      const subscriptionJson = subscription.toJSON();
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscriptionJson, userAgent: navigator.userAgent }),
      });

      if (!response.ok) {
        setStatus(t.shell.pushSaveFailed);
        setSubscribing(false);
        return;
      }

      setStatus(t.shell.pushEnabled);
    } catch {
      setStatus(t.shell.pushSetupFailed);
    } finally {
      setSubscribing(false);
    }
  }

  const enabled = status === t.shell.pushEnabled;

  return (
    <button
      className="flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-700 md:px-3"
      disabled={!supported || subscribing}
      title={status}
      onClick={() => void subscribe()}
    >
      {enabled ? <Bell className="h-4 w-4 text-safe" /> : <BellOff className="h-4 w-4" />}
      <span className="hidden xl:inline">{subscribing ? t.shell.subscribing : status}</span>
    </button>
  );
}
