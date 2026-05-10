import { ProactiveWorkspace } from "@/components/proactive/proactive-workspace";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import { listDemoProactiveReports } from "@/lib/demo-store";
import { departments as seedDepartments, proactiveReports as seedProactiveReports, users as seedUsers } from "@/lib/seed-data";
import type { Department, ProactiveReport, TenantUser } from "@/lib/types";

export default async function ProactivePage() {
  if (!isSupabaseConfigured()) {
    return (
      <ProactiveWorkspace
        departments={seedDepartments}
        users={seedUsers}
        initialReports={[...listDemoProactiveReports(), ...seedProactiveReports]}
      />
    );
  }

  const tenant = await getCurrentTenant();
  const supabase = createSupabaseServerClient();

  const [reportsResult, departmentsResult, usersResult] = await Promise.all([
    supabase
      .from("proactive_reports")
      .select("id, company_id, department_id, reporter_id, report_type, description, location, photo_url, risk_level, status, anonymous, created_at, assigned_to, action_taken")
      .eq("company_id", tenant.company.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("departments")
      .select("id, company_id, name, manager_id")
      .eq("company_id", tenant.company.id),
    supabase
      .from("users")
      .select("id, company_id, role, full_name, email, department_id, language")
      .eq("company_id", tenant.company.id),
  ]);

  const reports: ProactiveReport[] = (reportsResult.data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    departmentId: row.department_id,
    reporterId: row.reporter_id,
    reportType: row.report_type,
    description: row.description,
    location: row.location,
    photoUrl: row.photo_url,
    riskLevel: row.risk_level,
    status: row.status,
    anonymous: row.anonymous,
    createdAt: row.created_at,
    assignedTo: row.assigned_to,
    actionTaken: row.action_taken,
  }));

  const departments: Department[] = (departmentsResult.data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    managerId: row.manager_id,
  }));

  const users: TenantUser[] = (usersResult.data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    departmentId: row.department_id ?? "",
    language: row.language,
  }));

  return (
    <ProactiveWorkspace
      departments={departments}
      users={users}
      initialReports={reports}
    />
  );
}
