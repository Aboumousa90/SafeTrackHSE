import { AnalyticsWorkspace } from "@/components/analytics/analytics-workspace";
import { getDemoAnalyticsSnapshot } from "@/lib/analytics/data";

export default function AnalyticsPage() {
  const snapshot = getDemoAnalyticsSnapshot(2026, 5);

  return <AnalyticsWorkspace snapshot={snapshot} />;
}
