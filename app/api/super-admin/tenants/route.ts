import { NextResponse } from "next/server";
import { getDemoPlatformHealthChecks, getDemoTenantSummaries } from "@/lib/platform/super-admin-data";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";

export async function GET() {
  const tenant = await getCurrentTenant();

  if (!tenant.isSeed && tenant.user.role !== "super_admin") {
    return NextResponse.json({ error: "Super admin access required" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      tenants: getDemoTenantSummaries(),
      healthChecks: getDemoPlatformHealthChecks(),
      demoMode: true,
    });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, industry, country, subscription_plan, users(id), incidents(id, severity_level), incident_measures(id, status), proactive_reports(id), observation_rounds(id)");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tenants: data ?? [], healthChecks: getDemoPlatformHealthChecks(), demoMode: false });
}
