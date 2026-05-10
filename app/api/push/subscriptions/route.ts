import { NextResponse } from "next/server";
import { z } from "zod";
import { saveDemoPushSubscription } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import type { PushSubscriptionRecord } from "@/lib/types";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = subscriptionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push subscription payload" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const record: PushSubscriptionRecord = {
    id: crypto.randomUUID(),
    companyId: tenant.company.id,
    userId: tenant.user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: parsed.data.userAgent ?? "",
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured()) {
    saveDemoPushSubscription(record);
    return NextResponse.json({ subscription: record, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("push_subscriptions").upsert({
    company_id: record.companyId,
    user_id: record.userId,
    endpoint: record.endpoint,
    p256dh: record.p256dh,
    auth: record.auth,
    user_agent: record.userAgent,
  }, { onConflict: "endpoint" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ subscription: record, demoMode: false });
}
