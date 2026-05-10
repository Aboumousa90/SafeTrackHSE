import { listDemoIncidents, listDemoMeasures, listDemoObservationRounds, listDemoProactiveReports, listDemoPushSubscriptions, listDemoUsers } from "@/lib/demo-store";
import { company, incidents, measures, observationRounds, proactiveReports, users } from "@/lib/seed-data";
import type { PlatformHealthCheck, PlatformTenantSummary } from "@/lib/types";

function currentMonth(dateValue: string) {
  const date = new Date(dateValue);
  return date.getUTCFullYear() === 2026 && date.getUTCMonth() === 4;
}

export function getDemoTenantSummaries(): PlatformTenantSummary[] {
  const allIncidents = [...listDemoIncidents(), ...incidents];
  const allMeasures = [...listDemoMeasures(), ...measures];
  const allProactive = [...listDemoProactiveReports(), ...proactiveReports];
  const allRounds = [...listDemoObservationRounds(), ...observationRounds];
  const allUsers = [...listDemoUsers(), ...users];
  const overdueMeasures = allMeasures.filter((measure) => new Date(measure.dueDate) < new Date("2026-05-10") && measure.status !== "verified").length;
  const highSeverityIncidents = allIncidents.filter((incident) => incident.severityLevel === "S1" || incident.severityLevel === "S2").length;
  const healthScore = Math.max(42, 100 - highSeverityIncidents * 12 - overdueMeasures * 8 + allProactive.length * 2);

  return [
    {
      companyId: company.id,
      companyName: company.name,
      country: company.country,
      industry: company.industry,
      subscriptionPlan: company.subscriptionPlan,
      activeUsers: allUsers.length,
      incidentsThisMonth: allIncidents.filter((incident) => currentMonth(incident.incidentDate)).length,
      highSeverityIncidents,
      openMeasures: allMeasures.filter((measure) => measure.status === "open" || measure.status === "in_progress").length,
      overdueMeasures,
      proactiveReports: allProactive.length,
      observationRounds: allRounds.length,
      storageGb: 7.4,
      rlsStatus: "enforced",
      healthScore,
    },
    {
      companyId: "c-200",
      companyName: "SafeTrack Logistics Netherlands",
      country: "NL",
      industry: "Logistics",
      subscriptionPlan: "Professional",
      activeUsers: 64,
      incidentsThisMonth: 5,
      highSeverityIncidents: 1,
      openMeasures: 14,
      overdueMeasures: 3,
      proactiveReports: 31,
      observationRounds: 18,
      storageGb: 4.2,
      rlsStatus: "enforced",
      healthScore: 78,
    },
    {
      companyId: "c-300",
      companyName: "SafeTrack Manufacturing France",
      country: "FR",
      industry: "Discrete manufacturing",
      subscriptionPlan: "Basic",
      activeUsers: 22,
      incidentsThisMonth: 1,
      highSeverityIncidents: 0,
      openMeasures: 5,
      overdueMeasures: 0,
      proactiveReports: 6,
      observationRounds: 4,
      storageGb: 1.1,
      rlsStatus: "review_required",
      healthScore: 88,
    },
  ];
}

export function getDemoPlatformHealthChecks(): PlatformHealthCheck[] {
  return [
    {
      name: "Tenant RLS isolation",
      status: "ok",
      detail: "All production tables declare company_id scoped RLS policies; one demo tenant is flagged for review.",
    },
    {
      name: "Push notification readiness",
      status: listDemoPushSubscriptions().length > 0 ? "ok" : "warning",
      detail: listDemoPushSubscriptions().length > 0 ? "At least one browser subscription is registered in demo memory." : "No demo push subscription registered yet.",
    },
    {
      name: "AI rate limiting",
      status: "ok",
      detail: "Root cause analysis endpoints use per-user hourly limits before calling Claude.",
    },
    {
      name: "Storage controls",
      status: "ok",
      detail: "Uploads validate MIME type and 10MB file size before storing attachments.",
    },
  ];
}
