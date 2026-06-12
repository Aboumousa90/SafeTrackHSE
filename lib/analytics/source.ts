import { getDemoAnalyticsSnapshot } from "@/lib/analytics/data";
import { generateHseAnalyticsSnapshot, type AnalyticsInput } from "@/lib/analytics/snapshot";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  Department,
  HseAnalyticsSnapshot,
  Incident,
  Measure,
  MuopoCategory,
  ObservationItem,
  ObservationRound,
  Priority,
  ProactiveReport,
  SeverityLevel,
} from "@/lib/types";

export interface AnalyticsResult {
  snapshot: HseAnalyticsSnapshot;
  dataSource: "supabase" | "demo";
}

/**
 * Builds the monthly analytics snapshot from live tenant data when Supabase
 * is configured; falls back to the seeded demo dataset otherwise (or when a
 * query fails, so the dashboard always renders).
 */
export async function getAnalyticsSnapshot(companyId: string, periodYear: number, periodMonth: number): Promise<AnalyticsResult> {
  if (!isSupabaseConfigured()) {
    return { snapshot: getDemoAnalyticsSnapshot(periodYear, periodMonth), dataSource: "demo" };
  }

  try {
    const input = await loadAnalyticsInput(companyId, periodYear, periodMonth);
    return { snapshot: generateHseAnalyticsSnapshot(input), dataSource: "supabase" };
  } catch {
    return { snapshot: getDemoAnalyticsSnapshot(periodYear, periodMonth), dataSource: "demo" };
  }
}

async function loadAnalyticsInput(companyId: string, periodYear: number, periodMonth: number): Promise<AnalyticsInput> {
  const supabase = createSupabaseServerClient();
  // The 12-month trend needs trailing history; fetch 13 months for safety.
  const historyStart = new Date(Date.UTC(periodYear, periodMonth - 13, 1)).toISOString().slice(0, 10);

  const [departments, incidents, proactiveReports, observationRounds, measures, analyses] = await Promise.all([
    supabase.from("departments").select("id, name").eq("company_id", companyId),
    supabase
      .from("incidents")
      .select("id, department_id, severity_level, incident_date, incident_time, title, description, location, status, is_pse, reference_number, created_at")
      .eq("company_id", companyId)
      .gte("incident_date", historyStart),
    supabase
      .from("proactive_reports")
      .select("id, department_id, risk_level, status, created_at")
      .eq("company_id", companyId)
      .gte("created_at", historyStart),
    supabase
      .from("observation_rounds")
      .select("id, department_id, round_date, round_time, observations, overall_score, follow_up_required")
      .eq("company_id", companyId)
      .gte("round_date", historyStart),
    supabase
      .from("incident_measures")
      .select("id, incident_id, muopo_category, description, due_date, priority, status")
      .eq("company_id", companyId),
    supabase.from("incident_analyses").select("root_causes, incidents!inner(company_id)").eq("incidents.company_id", companyId),
  ]);

  const firstError = [departments, incidents, proactiveReports, observationRounds, measures, analyses].find((result) => result.error);
  if (firstError?.error) {
    throw new Error(firstError.error.message);
  }

  return {
    companyId,
    periodYear,
    periodMonth,
    departments: (departments.data ?? []).map(
      (row): Department => ({ id: row.id, companyId, name: row.name, managerId: "" }),
    ),
    incidents: (incidents.data ?? []).map(
      (row): Incident => ({
        id: row.id,
        companyId,
        referenceNumber: row.reference_number,
        title: row.title,
        description: row.description,
        incidentDate: row.incident_date,
        incidentTime: row.incident_time ?? "",
        departmentId: row.department_id ?? "",
        involvedPersonName: "",
        reporterId: "",
        location: row.location ?? "",
        locationDetail: "",
        isVictim: false,
        injuryLocation: null,
        severityLevel: row.severity_level as SeverityLevel,
        severityRationale: "",
        isPse: Boolean(row.is_pse),
        isUndesiredRelease: false,
        status: row.status,
        createdAt: row.created_at,
      }),
    ),
    proactiveReports: (proactiveReports.data ?? []).map(
      (row): ProactiveReport => ({
        id: row.id,
        companyId,
        departmentId: row.department_id ?? "",
        reporterId: null,
        reportType: "unsafe_condition",
        description: "",
        location: "",
        riskLevel: row.risk_level,
        status: row.status,
        anonymous: false,
        createdAt: row.created_at,
      }),
    ),
    observationRounds: (observationRounds.data ?? []).map(
      (row): ObservationRound => ({
        id: row.id,
        companyId,
        observerId: "",
        departmentId: row.department_id ?? "",
        roundDate: row.round_date,
        roundTime: row.round_time ?? "",
        location: "",
        observations: (row.observations ?? []) as ObservationItem[],
        overallScore: row.overall_score ?? 0,
        followUpRequired: Boolean(row.follow_up_required),
        notes: "",
        createdAt: row.round_date,
      }),
    ),
    measures: (measures.data ?? []).map(
      (row): Measure => ({
        id: row.id,
        incidentId: row.incident_id,
        muopoCategory: row.muopo_category as MuopoCategory,
        description: row.description,
        responsiblePersonId: "",
        dueDate: row.due_date,
        priority: row.priority as Priority,
        status: row.status,
      }),
    ),
    rootCauses: (analyses.data ?? []).flatMap((row) => (row.root_causes ?? []) as string[]),
  };
}
