import { MeasuresBoard } from "@/components/measures/measures-board";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import { listDemoMeasures, listDemoSuggestedMeasures } from "@/lib/demo-store";
import { measures as seedMeasures, users as seedUsers } from "@/lib/seed-data";
import type { Measure, TenantUser } from "@/lib/types";

export default async function MeasuresPage() {
  if (!isSupabaseConfigured()) {
    return (
      <MeasuresBoard
        initialMeasures={[...listDemoMeasures(), ...seedMeasures]}
        initialSuggestions={listDemoSuggestedMeasures()}
        users={seedUsers}
      />
    );
  }

  const tenant = await getCurrentTenant();
  const supabase = createSupabaseServerClient();

  const [measuresResult, usersResult] = await Promise.all([
    supabase
      .from("incident_measures")
      .select("id, incident_id, muopo_category, description, responsible_person_id, due_date, priority, status, evidence_url, completed_at, verified_at, verified_by")
      .eq("company_id", tenant.company.id)
      .order("due_date", { ascending: true }),
    supabase
      .from("users")
      .select("id, company_id, role, full_name, email, department_id, language")
      .eq("company_id", tenant.company.id),
  ]);

  const measures: Measure[] = (measuresResult.data ?? []).map((row) => ({
    id: row.id,
    incidentId: row.incident_id,
    muopoCategory: row.muopo_category,
    description: row.description,
    responsiblePersonId: row.responsible_person_id,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    evidenceUrl: row.evidence_url,
    completedAt: row.completed_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
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
    <MeasuresBoard
      initialMeasures={measures}
      initialSuggestions={listDemoSuggestedMeasures()}
      users={users}
    />
  );
}
