import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard";
import { getDemoPlatformHealthChecks, getDemoTenantSummaries } from "@/lib/platform/super-admin-data";
import { getReleaseReadiness } from "@/lib/platform/readiness";

export default function SuperAdminPage() {
  return (
    <SuperAdminDashboard
      tenants={getDemoTenantSummaries()}
      healthChecks={getDemoPlatformHealthChecks()}
      readiness={getReleaseReadiness()}
    />
  );
}
