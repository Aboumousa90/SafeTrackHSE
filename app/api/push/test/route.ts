import { NextResponse } from "next/server";
import { listDemoPushSubscriptions } from "@/lib/demo-store";
import { sendPushNotification } from "@/lib/push/web-push";

export async function POST() {
  const subscription = listDemoPushSubscriptions()[0];
  if (!subscription) {
    return NextResponse.json({ error: "No push subscription available in demo mode." }, { status: 404 });
  }

  const result = await sendPushNotification(subscription, {
    title: "SafeTrack notification test",
    body: "Push notifications are connected for this browser.",
    url: "/dashboard",
  });

  return NextResponse.json({ ...result, demoMode: true });
}
