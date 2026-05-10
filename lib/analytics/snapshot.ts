import type {
  AnalysisFinding,
  Department,
  HseAnalyticsSnapshot,
  Incident,
  Measure,
  MuopoCategory,
  ProactiveReport,
  SeverityLevel,
  ObservationRound,
} from "@/lib/types";

export interface AnalyticsInput {
  companyId: string;
  departments: Department[];
  incidents: Incident[];
  proactiveReports: ProactiveReport[];
  observationRounds: ObservationRound[];
  measures: Measure[];
  rootCauses: AnalysisFinding["rootCauses"];
  periodYear: number;
  periodMonth: number;
}

const severityLevels: SeverityLevel[] = ["S1", "S2", "S3", "S4", "S5"];
const muopoCategories: MuopoCategory[] = ["M", "U", "O", "P", "O2"];
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isInPeriod(dateValue: string, year: number, month: number) {
  const date = new Date(dateValue);
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function countBySeverity(incidents: Incident[]) {
  return severityLevels.reduce<Record<SeverityLevel, number>>((acc, level) => {
    acc[level] = incidents.filter((incident) => incident.severityLevel === level).length;
    return acc;
  }, { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 });
}

function countMuopo(measures: Measure[]) {
  return muopoCategories.reduce<Record<MuopoCategory, number>>((acc, category) => {
    acc[category] = measures.filter((measure) => measure.muopoCategory === category && measure.status !== "verified").length;
    return acc;
  }, { M: 0, U: 0, O: 0, P: 0, O2: 0 });
}

function buildDepartmentRanking(input: AnalyticsInput) {
  return input.departments
    .map((department) => {
      const incidents = input.incidents.filter((incident) => incident.departmentId === department.id);
      const proactiveReports = input.proactiveReports.filter((report) => report.departmentId === department.id);
      const observationIssues = input.observationRounds
        .filter((roundItem) => roundItem.departmentId === department.id)
        .flatMap((roundItem) => roundItem.observations)
        .filter((observation) => observation.status === "not_ok").length;
      const severeWeight = incidents.filter((incident) => incident.severityLevel === "S1" || incident.severityLevel === "S2").length * 18;
      const riskScore = Math.min(100, incidents.length * 20 + severeWeight + proactiveReports.filter((report) => report.riskLevel === "high" || report.riskLevel === "critical").length * 12 + observationIssues * 10);

      return {
        departmentId: department.id,
        departmentName: department.name,
        incidents: incidents.length,
        proactiveReports: proactiveReports.length,
        observationIssues,
        riskScore,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

function buildPareto(rootCauses: string[]) {
  const counts = rootCauses.reduce<Record<string, number>>((acc, cause) => {
    const key = cause.includes("Maintenance") ? "Maintenance standards" : cause.includes("Supervisory") ? "Supervisory verification" : cause.includes("traffic") ? "Traffic segregation" : cause.split(" ").slice(0, 3).join(" ");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0) || 1;
  let cumulative = 0;
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      cumulative += count;
      return { name, count, cumulative: round((cumulative / total) * 100) };
    });
}

function buildTrend(input: AnalyticsInput) {
  return Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(Date.UTC(input.periodYear, input.periodMonth - 12 + index, 1));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const incidents = input.incidents.filter((incident) => isInPeriod(incident.incidentDate, year, month)).length;
    const proactiveReports = input.proactiveReports.filter((report) => isInPeriod(report.createdAt, year, month)).length;

    return {
      month: monthLabels[month - 1],
      incidents,
      proactiveReports,
      proactiveRatio: incidents === 0 ? proactiveReports : round(proactiveReports / incidents),
    };
  });
}

function buildNarrative(input: {
  ranking: ReturnType<typeof buildDepartmentRanking>;
  overdueMeasuresRate: number;
  proactiveReactiveRatio: number;
  totalIncidents: number;
  observationIssues: number;
}) {
  const topDepartment = input.ranking[0]?.departmentName ?? "No department";
  const trend = input.proactiveReactiveRatio >= 2 ? "improving proactive visibility" : "limited proactive signal compared with incidents";
  const measureMessage = input.overdueMeasuresRate > 25 ? "Measure closure discipline is a systemic weakness and needs management attention." : "Measure closure is currently controlled, with limited overdue exposure.";

  return [
    `Top systemic weakness: ${topDepartment} carries the highest combined risk score from incidents, proactive reports, and observation issues.`,
    `Trend commentary: ${trend}; ${input.totalIncidents} incident(s) were recorded in the selected month.`,
    `Priority focus areas: close Not OK observation items, verify MUOPO actions, and target high-risk departments first.`,
    `Positive highlights: ${input.proactiveReactiveRatio.toFixed(1)} proactive report(s) per incident indicates active frontline reporting. ${measureMessage}`,
  ].join("\n\n");
}

export function generateHseAnalyticsSnapshot(input: AnalyticsInput): HseAnalyticsSnapshot {
  const monthlyIncidents = input.incidents.filter((incident) => isInPeriod(incident.incidentDate, input.periodYear, input.periodMonth));
  const monthlyProactiveReports = input.proactiveReports.filter((report) => isInPeriod(report.createdAt, input.periodYear, input.periodMonth));
  const monthlyObservationRounds = input.observationRounds.filter((roundItem) => isInPeriod(roundItem.roundDate, input.periodYear, input.periodMonth));
  const completedMeasures = input.measures.filter((measure) => measure.status === "completed" || measure.status === "verified").length;
  const overdueMeasures = input.measures.filter((measure) => new Date(measure.dueDate) < new Date(Date.UTC(input.periodYear, input.periodMonth, 1)) && measure.status !== "verified").length;
  const observationIssues = monthlyObservationRounds.flatMap((roundItem) => roundItem.observations).filter((observation) => observation.status === "not_ok").length;
  const ranking = buildDepartmentRanking({ ...input, incidents: monthlyIncidents, proactiveReports: monthlyProactiveReports, observationRounds: monthlyObservationRounds });
  const proactiveReactiveRatio = monthlyIncidents.length === 0 ? monthlyProactiveReports.length : round(monthlyProactiveReports.length / monthlyIncidents.length);
  const overdueMeasuresRate = input.measures.length === 0 ? 0 : round((overdueMeasures / input.measures.length) * 100);

  return {
    id: `${input.companyId}-${input.periodYear}-${String(input.periodMonth).padStart(2, "0")}`,
    companyId: input.companyId,
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    totalIncidents: monthlyIncidents.length,
    incidentsBySeverity: countBySeverity(monthlyIncidents),
    totalProactiveReports: monthlyProactiveReports.length,
    observationRoundsCount: monthlyObservationRounds.length,
    measureCompletionRate: input.measures.length === 0 ? 0 : round((completedMeasures / input.measures.length) * 100),
    overdueMeasuresRate,
    proactiveReactiveRatio,
    muopoBreakdown: countMuopo(input.measures),
    departmentRiskRanking: ranking,
    rootCausePareto: buildPareto(input.rootCauses),
    monthlyTrend: buildTrend(input),
    aiInsights: buildNarrative({ ranking, overdueMeasuresRate, proactiveReactiveRatio, totalIncidents: monthlyIncidents.length, observationIssues }),
    generatedAt: new Date().toISOString(),
  };
}

export function analyticsSnapshotToCsv(snapshot: HseAnalyticsSnapshot) {
  const rows = [
    ["metric", "value"],
    ["period", `${snapshot.periodYear}-${String(snapshot.periodMonth).padStart(2, "0")}`],
    ["total_incidents", String(snapshot.totalIncidents)],
    ["total_proactive_reports", String(snapshot.totalProactiveReports)],
    ["observation_rounds", String(snapshot.observationRoundsCount)],
    ["measure_completion_rate", String(snapshot.measureCompletionRate)],
    ["overdue_measures_rate", String(snapshot.overdueMeasuresRate)],
    ["proactive_reactive_ratio", String(snapshot.proactiveReactiveRatio)],
    ...Object.entries(snapshot.incidentsBySeverity).map(([level, count]) => [`incidents_${level}`, String(count)]),
    ...Object.entries(snapshot.muopoBreakdown).map(([category, count]) => [`muopo_${category}`, String(count)]),
  ];

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
}
