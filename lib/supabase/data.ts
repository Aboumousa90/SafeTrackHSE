import type { Department, Incident, Measure, ProactiveReport } from "@/lib/types";
import { departments as seedDepartments, incidents as seedIncidents, measures as seedMeasures, proactiveReports as seedProactiveReports } from "@/lib/seed-data";
import { listDemoIncidents } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";

interface IncidentRow {
  id: string;
  company_id: string;
  reference_number: string;
  title: string;
  description: string;
  incident_date: string;
  incident_time: string;
  department_id: string;
  involved_person_id: string | null;
  reporter_id: string;
  location: string;
  location_detail: string | null;
  is_victim: boolean;
  injury_location: string | null;
  severity_level: Incident["severityLevel"];
  severity_rationale: string | null;
  is_pse: boolean;
  is_undesired_release: boolean;
  status: Incident["status"];
  created_at: string;
}

interface MeasureRow {
  id: string;
  incident_id: string;
  muopo_category: Measure["muopoCategory"];
  description: string;
  responsible_person_id: string;
  due_date: string;
  priority: Measure["priority"];
  status: Measure["status"];
}

interface ProactiveReportRow {
  id: string;
  company_id: string;
  department_id: string;
  reporter_id: string | null;
  report_type: ProactiveReport["reportType"];
  description: string;
  location: string;
  risk_level: ProactiveReport["riskLevel"];
  status: ProactiveReport["status"];
  anonymous: boolean;
  created_at: string;
}

function mapIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    companyId: row.company_id,
    referenceNumber: row.reference_number,
    title: row.title,
    description: row.description,
    incidentDate: row.incident_date,
    incidentTime: row.incident_time,
    departmentId: row.department_id,
    involvedPersonName: row.involved_person_id ?? "Restricted",
    reporterId: row.reporter_id,
    location: row.location,
    locationDetail: row.location_detail ?? "",
    isVictim: row.is_victim,
    injuryLocation: row.injury_location,
    severityLevel: row.severity_level,
    severityRationale: row.severity_rationale ?? "",
    isPse: row.is_pse,
    isUndesiredRelease: row.is_undesired_release,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getDashboardData() {
  const tenant = await getCurrentTenant();
  if (!isSupabaseConfigured() || tenant.isSeed) {
    return {
      departments: seedDepartments,
      incidents: [...listDemoIncidents(), ...seedIncidents],
      measures: seedMeasures,
      proactiveReports: seedProactiveReports,
    };
  }

  const supabase = createSupabaseServerClient();
  const [departmentsResult, incidentsResult, measuresResult, proactiveResult] = await Promise.all([
    supabase.from("departments").select("id, company_id, name, manager_id").eq("company_id", tenant.company.id).returns<Array<{ id: string; company_id: string; name: string; manager_id: string }>>(),
    supabase.from("incidents").select("*").eq("company_id", tenant.company.id).order("incident_date", { ascending: false }).returns<IncidentRow[]>(),
    supabase.from("incident_measures").select("id, incident_id, muopo_category, description, responsible_person_id, due_date, priority, status").eq("company_id", tenant.company.id).returns<MeasureRow[]>(),
    supabase.from("proactive_reports").select("id, company_id, department_id, reporter_id, report_type, description, location, risk_level, status, anonymous, created_at").eq("company_id", tenant.company.id).returns<ProactiveReportRow[]>(),
  ]);

  if (departmentsResult.error || incidentsResult.error || measuresResult.error || proactiveResult.error) {
    throw new Error("Unable to load tenant dashboard data.");
  }

  return {
    departments: departmentsResult.data.map((department): Department => ({
      id: department.id,
      companyId: department.company_id,
      name: department.name,
      managerId: department.manager_id,
    })),
    incidents: incidentsResult.data.map(mapIncident),
    measures: measuresResult.data.map((measure): Measure => ({
      id: measure.id,
      incidentId: measure.incident_id,
      muopoCategory: measure.muopo_category,
      description: measure.description,
      responsiblePersonId: measure.responsible_person_id,
      dueDate: measure.due_date,
      priority: measure.priority,
      status: measure.status,
    })),
    proactiveReports: proactiveResult.data.map((report): ProactiveReport => ({
      id: report.id,
      companyId: report.company_id,
      departmentId: report.department_id,
      reporterId: report.reporter_id,
      reportType: report.report_type,
      description: report.description,
      location: report.location,
      riskLevel: report.risk_level,
      status: report.status,
      anonymous: report.anonymous,
      createdAt: report.created_at,
    })),
  };
}
