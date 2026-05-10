import { IncidentWizard } from "@/components/incidents/incident-wizard";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import { departments as seedDepartments, users as seedUsers, severityMatrix as seedSeverityMatrix, company as seedCompany } from "@/lib/seed-data";
import type { Department, TenantUser } from "@/lib/types";

function derivePrefix(companyName: string): string {
  const words = companyName.trim().split(/\s+/);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("").slice(0, 4) || "HSE";
}

export default async function NewIncidentPage() {
  if (!isSupabaseConfigured()) {
    return (
      <IncidentWizard
        departments={seedDepartments}
        users={seedUsers}
        severityMatrix={seedSeverityMatrix}
        currentUserName={seedUsers[0]?.fullName ?? ""}
        companyPrefix={derivePrefix(seedCompany.name)}
      />
    );
  }

  const tenant = await getCurrentTenant();
  const supabase = createSupabaseServerClient();

  const [departmentsResult, usersResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id, company_id, name, manager_id")
      .eq("company_id", tenant.company.id),
    supabase
      .from("users")
      .select("id, company_id, role, full_name, email, department_id, language")
      .eq("company_id", tenant.company.id),
  ]);

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
    <IncidentWizard
      departments={departments.length > 0 ? departments : seedDepartments}
      users={users}
      severityMatrix={seedSeverityMatrix}
      currentUserName={tenant.user.fullName}
      companyPrefix={derivePrefix(tenant.company.name)}
    />
  );
}
