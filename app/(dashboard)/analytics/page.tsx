import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { enrichSnapshotWithAiInsights } from "@/lib/ai/insights";
import { getDemoAnalyticsSnapshot } from "@/lib/analytics/data";
import { getCurrentTenant } from "@/lib/supabase/tenant";

// AI insights are generated per request (with a short server-side cache),
// so this page must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const tenant = await getCurrentTenant();
  const snapshot = await enrichSnapshotWithAiInsights(getDemoAnalyticsSnapshot(2026, 5), tenant.user.language);

  return <AnalyticsWorkspace snapshot={snapshot} />;
}
