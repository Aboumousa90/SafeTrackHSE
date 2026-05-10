import { generateHseAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import { listDemoAnalyses, listDemoIncidents, listDemoMeasures, listDemoObservationRounds, listDemoProactiveReports } from "@/lib/demo-store";
import { analysisFinding, company, departments, incidents, measures, observationRounds, proactiveReports } from "@/lib/seed-data";

export function getDemoAnalyticsSnapshot(periodYear = 2026, periodMonth = 5) {
  const demoAnalyses = listDemoAnalyses();
  const rootCauses = [
    ...analysisFinding.rootCauses,
    ...demoAnalyses.flatMap((analysis) => analysis.finding.rootCauses),
  ];

  return generateHseAnalyticsSnapshot({
    companyId: company.id,
    departments,
    incidents: [...listDemoIncidents(), ...incidents],
    proactiveReports: [...listDemoProactiveReports(), ...proactiveReports],
    observationRounds: [...listDemoObservationRounds(), ...observationRounds],
    measures: [...listDemoMeasures(), ...measures],
    rootCauses,
    periodYear,
    periodMonth,
  });
}
