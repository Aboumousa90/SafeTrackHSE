import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import { getDemoCompany, getDemoCompanyConfig, listDemoDepartments, listDemoIncidents, listDemoUsers } from "@/lib/demo-store";
import { company as seedCompany, companyConfig as seedConfig, departments as seedDepartments, users as seedUsers } from "@/lib/seed-data";
import type { CompanyConfig, Department, TenantUser } from "@/lib/types";

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    const effectiveCompany = getDemoCompany() ?? seedCompany;
    const effectiveDepartments = [...listDemoDepartments(), ...seedDepartments];
    const effectiveUsers = [...listDemoUsers(), ...seedUsers];
    const effectiveConfig = getDemoCompanyConfig() ?? seedConfig;
    return (
      <SettingsWorkspace
        initialCompany={effectiveCompany}
        initialDepartments={effectiveDepartments}
        initialUsers={effectiveUsers}
        initialConfig={effectiveConfig}
        usage={{
          incidentsThisMonth: listDemoIncidents().length + 42,
          activeUsers: effectiveUsers.length,
          storageGb: 7.4,
        }}
      />
    );
  }

  const tenant = await getCurrentTenant();
  const supabase = createSupabaseServerClient();

  const [configResult, departmentsResult, usersResult, incidentsCountResult] = await Promise.all([
    supabase
      .from("company_configs")
      .select("id, company_id, severity_matrix, corporate_pse_standard, notification_settings, report_template_url, slide_template_url")
      .eq("company_id", tenant.company.id)
      .maybeSingle(),
    supabase
      .from("departments")
      .select("id, company_id, name, manager_id")
      .eq("company_id", tenant.company.id),
    supabase
      .from("users")
      .select("id, company_id, role, full_name, email, department_id, language")
      .eq("company_id", tenant.company.id),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", tenant.company.id)
      .gte("incident_date", `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`),
  ]);

  const config: CompanyConfig = configResult.data
    ? {
        id: configResult.data.id,
        companyId: configResult.data.company_id,
        severityMatrix: configResult.data.severity_matrix ?? [],
        corporatePseStandard: configResult.data.corporate_pse_standard ?? [],
        notificationSettings: configResult.data.notification_settings ?? seedConfig.notificationSettings,
        reportTemplateUrl: configResult.data.report_template_url,
        slideTemplateUrl: configResult.data.slide_template_url,
        footerText: tenant.company.name + " - Internal HSE report",
        brandColor: "#1B4F72",
      }
    : { ...seedConfig, companyId: tenant.company.id };

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
    <SettingsWorkspace
      initialCompany={tenant.company}
      initialDepartments={departments}
      initialUsers={users}
      initialConfig={config}
      usage={{
        incidentsThisMonth: incidentsCountResult.count ?? 0,
        activeUsers: users.length,
        storageGb: 0,
      }}
    />
  );
}
