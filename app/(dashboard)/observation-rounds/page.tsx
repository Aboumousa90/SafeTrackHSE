import { ObservationRoundsWorkspace } from "@/components/observation-rounds/observation-rounds-workspace";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import { listDemoObservationRounds } from "@/lib/demo-store";
import { departments as seedDepartments, observationRounds as seedRounds, users as seedUsers } from "@/lib/seed-data";
import type { Department, ObservationRound, TenantUser } from "@/lib/types";

export default async function ObservationRoundsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <ObservationRoundsWorkspace
        departments={seedDepartments}
        users={seedUsers}
        initialRounds={[...listDemoObservationRounds(), ...seedRounds]}
      />
    );
  }

  const tenant = await getCurrentTenant();
  const supabase = createSupabaseServerClient();

  const [roundsResult, departmentsResult, usersResult] = await Promise.all([
    supabase
      .from("observation_rounds")
      .select("id, company_id, observer_id, department_id, round_date, round_time, location, observations, overall_score, follow_up_required, notes, created_at")
      .eq("company_id", tenant.company.id)
      .order("round_date", { ascending: false }),
    supabase
      .from("departments")
      .select("id, company_id, name, manager_id")
      .eq("company_id", tenant.company.id),
    supabase
      .from("users")
      .select("id, company_id, role, full_name, email, department_id, language")
      .eq("company_id", tenant.company.id),
  ]);

  const rounds: ObservationRound[] = (roundsResult.data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    observerId: row.observer_id,
    departmentId: row.department_id,
    roundDate: row.round_date,
    roundTime: row.round_time,
    location: row.location,
    observations: row.observations ?? [],
    overallScore: row.overall_score,
    followUpRequired: row.follow_up_required,
    notes: row.notes ?? "",
    createdAt: row.created_at,
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
    <ObservationRoundsWorkspace
      departments={departments}
      users={users}
      initialRounds={rounds}
    />
  );
}
