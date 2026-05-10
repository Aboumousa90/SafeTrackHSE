import webpush from "web-push";
import type { PushSubscriptionRecord } from "@/lib/types";

export function configureWebPush() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails("mailto:hse@safetrack.example", publicKey, privateKey);
  return true;
}

export function getPublicVapidKey() {
  return process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? process.env.WEB_PUSH_PUBLIC_KEY ?? "";
}

export async function sendPushNotification(subscription: PushSubscriptionRecord, payload: { title: string; body: string; url: string }) {
  if (!configureWebPush()) {
    return { sent: false, configured: false };
  }

  await webpush.sendNotification({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  }, JSON.stringify(payload));

  return { sent: true, configured: true };
}
