import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { enrichSnapshotWithAiInsights } from "@/lib/ai/insights";
import { getAnalyticsSnapshot } from "@/lib/analytics/source";
import { getCurrentTenant } from "@/lib/supabase/tenant";

// Live tenant data and AI insights are fetched per request (with a short
// server-side cache), so this page must not be statically prerendered.
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const tenant = await getCurrentTenant();
  const { snapshot } = await getAnalyticsSnapshot(tenant.company.id, 2026, 5);
  const enriched = await enrichSnapshotWithAiInsights(snapshot, tenant.user.language);

  return <AnalyticsWorkspace snapshot={enriched} />;
}
