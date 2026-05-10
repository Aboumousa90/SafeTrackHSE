import type { AnalysisFinding, AnalysisMethod, Company, CompanyConfig, Department, Incident, Measure, MeasureStatus, ObservationRound, ProactiveReport, PushSubscriptionRecord, SuggestedMeasure, TenantUser } from "@/lib/types";

interface DemoStore {
  incidents: Incident[];
  analyses: Array<{
    id: string;
    incidentId: string;
    method: AnalysisMethod;
    finding: AnalysisFinding;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    completedAt: string;
  }>;
  suggestedMeasures: SuggestedMeasure[];
  measures: Measure[];
  proactiveReports: ProactiveReport[];
  observationRounds: ObservationRound[];
  company?: Company;
  departments: Department[];
  users: TenantUser[];
  companyConfig?: CompanyConfig;
  pushSubscriptions: PushSubscriptionRecord[];
}

const globalStore = globalThis as typeof globalThis & { __safetrackDemoStore?: DemoStore };

export function getDemoStore() {
  if (!globalStore.__safetrackDemoStore) {
    globalStore.__safetrackDemoStore = { incidents: [], analyses: [], suggestedMeasures: [], measures: [], proactiveReports: [], observationRounds: [], departments: [], users: [], pushSubscriptions: [] };
  }
  globalStore.__safetrackDemoStore.incidents ??= [];
  globalStore.__safetrackDemoStore.analyses ??= [];
  globalStore.__safetrackDemoStore.suggestedMeasures ??= [];
  globalStore.__safetrackDemoStore.measures ??= [];
  globalStore.__safetrackDemoStore.proactiveReports ??= [];
  globalStore.__safetrackDemoStore.observationRounds ??= [];
  globalStore.__safetrackDemoStore.departments ??= [];
  globalStore.__safetrackDemoStore.users ??= [];
  globalStore.__safetrackDemoStore.pushSubscriptions ??= [];
  return globalStore.__safetrackDemoStore;
}

export function addDemoIncident(incident: Incident) {
  const store = getDemoStore();
  store.incidents = [incident, ...store.incidents.filter((item) => item.referenceNumber !== incident.referenceNumber)];
}

export function listDemoIncidents() {
  return getDemoStore().incidents;
}

export function saveDemoAnalysis(input: DemoStore["analyses"][number]) {
  const store = getDemoStore();
  store.analyses = [input, ...store.analyses.filter((analysis) => analysis.id !== input.id)];
}

export function listDemoAnalyses() {
  return getDemoStore().analyses;
}

export function addDemoSuggestedMeasures(measures: SuggestedMeasure[]) {
  const store = getDemoStore();
  const existingKeys = new Set(measures.map((measure) => measure.id));
  store.suggestedMeasures = [...measures, ...store.suggestedMeasures.filter((measure) => !existingKeys.has(measure.id))];
}

export function listDemoSuggestedMeasures() {
  return getDemoStore().suggestedMeasures;
}

export function addDemoMeasure(measure: Measure) {
  const store = getDemoStore();
  store.measures = [measure, ...store.measures.filter((item) => item.id !== measure.id)];
  store.suggestedMeasures = store.suggestedMeasures.filter((suggestion) => suggestion.id !== measure.id);
}

export function listDemoMeasures() {
  return getDemoStore().measures;
}

export function updateDemoMeasureStatus(id: string, status: MeasureStatus) {
  const store = getDemoStore();
  const now = new Date().toISOString();
  store.measures = store.measures.map((measure) => (
    measure.id === id
      ? {
          ...measure,
          status,
          completedAt: status === "completed" ? now : measure.completedAt,
          verifiedAt: status === "verified" ? now : measure.verifiedAt,
          verifiedBy: status === "verified" ? "u-1" : measure.verifiedBy,
        }
      : measure
  ));
}

export function attachDemoMeasureEvidence(id: string, evidenceUrl: string) {
  const store = getDemoStore();
  store.measures = store.measures.map((measure) => (measure.id === id ? { ...measure, evidenceUrl } : measure));
}

export function addDemoProactiveReport(report: ProactiveReport) {
  const store = getDemoStore();
  store.proactiveReports = [report, ...store.proactiveReports.filter((item) => item.id !== report.id)];
}

export function listDemoProactiveReports() {
  return getDemoStore().proactiveReports;
}

export function updateDemoProactiveReport(id: string, update: Pick<ProactiveReport, "status"> & Partial<Pick<ProactiveReport, "assignedTo" | "actionTaken">>) {
  const store = getDemoStore();
  store.proactiveReports = store.proactiveReports.map((report) => (report.id === id ? { ...report, ...update } : report));
}

export function addDemoObservationRound(round: ObservationRound) {
  const store = getDemoStore();
  store.observationRounds = [round, ...store.observationRounds.filter((item) => item.id !== round.id)];
}

export function listDemoObservationRounds() {
  return getDemoStore().observationRounds;
}

export function saveDemoCompany(company: Company) {
  getDemoStore().company = company;
}

export function getDemoCompany() {
  return getDemoStore().company;
}

export function addDemoDepartment(department: Department) {
  const store = getDemoStore();
  store.departments = [department, ...store.departments.filter((item) => item.id !== department.id)];
}

export function listDemoDepartments() {
  return getDemoStore().departments;
}

export function addDemoUser(user: TenantUser) {
  const store = getDemoStore();
  store.users = [user, ...store.users.filter((item) => item.id !== user.id)];
}

export function listDemoUsers() {
  return getDemoStore().users;
}

export function saveDemoCompanyConfig(config: CompanyConfig) {
  getDemoStore().companyConfig = config;
}

export function getDemoCompanyConfig() {
  return getDemoStore().companyConfig;
}

export function saveDemoPushSubscription(subscription: PushSubscriptionRecord) {
  const store = getDemoStore();
  store.pushSubscriptions = [subscription, ...store.pushSubscriptions.filter((item) => item.endpoint !== subscription.endpoint)];
}

export function listDemoPushSubscriptions() {
  return getDemoStore().pushSubscriptions;
}
