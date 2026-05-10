export type Locale = "nl" | "en" | "fr";
export type UserRole = "super_admin" | "company_admin" | "hse_manager" | "supervisor" | "employee";
export type SeverityLevel = "S1" | "S2" | "S3" | "S4" | "S5";
export type IncidentStatus = "draft" | "in_analysis" | "measures_defined" | "closed";
export type AnalysisMethod = "5why" | "fishbone" | "fmea" | "pareto" | "fault_tree" | "scatter";
export type MuopoCategory = "M" | "U" | "O" | "P" | "O2";
export type MeasureStatus = "open" | "in_progress" | "completed" | "verified";
export type Priority = "immediate" | "short_term" | "long_term";
export type ProactiveReportType = "near_miss" | "unsafe_condition" | "unsafe_act" | "positive_observation";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Company {
  id: string;
  name: string;
  logoUrl: string;
  industry: string;
  country: string;
  subscriptionPlan: "Basic" | "Professional" | "Enterprise";
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  managerId: string;
}

export interface TenantUser {
  id: string;
  companyId: string;
  role: UserRole;
  fullName: string;
  email: string;
  departmentId: string;
  language: Locale;
}

export interface SeverityCell {
  likelihood: number;
  consequence: number;
  level: SeverityLevel;
  label: string;
}

export interface CorporatePseRule {
  productClass: string;
  thresholdQuantity: number;
  unit: "kg" | "L" | "m3";
  classification: string;
  consequenceArea: string;
}

export interface NotificationSettings {
  newIncident: UserRole[];
  escalatedSeverity: UserRole[];
  overdueMeasure: UserRole[];
  monthlyAnalytics: UserRole[];
  proactiveHighRisk: UserRole[];
}

export interface CompanyConfig {
  id: string;
  companyId: string;
  severityMatrix: SeverityCell[];
  corporatePseStandard: CorporatePseRule[];
  notificationSettings: NotificationSettings;
  reportTemplateUrl: string | null;
  slideTemplateUrl: string | null;
  footerText: string;
  brandColor: string;
}

export interface Incident {
  id: string;
  companyId: string;
  referenceNumber: string;
  title: string;
  description: string;
  incidentDate: string;
  incidentTime: string;
  departmentId: string;
  involvedPersonName: string;
  reporterId: string;
  location: string;
  locationDetail: string;
  isVictim: boolean;
  injuryLocation: string | null;
  severityLevel: SeverityLevel;
  severityRationale: string;
  isPse: boolean;
  isUndesiredRelease: boolean;
  status: IncidentStatus;
  createdAt: string;
}

export interface PseData {
  productName: string;
  casNumber: string;
  quantity: number;
  unit: "kg" | "L" | "m3";
  releaseDuration: string;
  containmentStatus: string;
  corporateClassification: string;
  consequenceArea: string;
}

export interface AnalysisFinding {
  directCauses: string[];
  underlyingCauses: string[];
  rootCauses: string[];
  contributingFactors: string[];
}

export interface Measure {
  id: string;
  incidentId: string;
  muopoCategory: MuopoCategory;
  description: string;
  responsiblePersonId: string;
  dueDate: string;
  priority: Priority;
  status: MeasureStatus;
  evidenceUrl?: string | null;
  completedAt?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
}

export interface SuggestedMeasure {
  id: string;
  incidentId: string;
  rootCause: string;
  muopoCategory: MuopoCategory;
  description: string;
  priority: Priority;
  suggestedResponsibleRole: string;
  estimatedEffort: "low" | "medium" | "high";
}

export interface ProactiveReport {
  id: string;
  companyId: string;
  departmentId: string;
  reporterId: string | null;
  reportType: ProactiveReportType;
  description: string;
  location: string;
  photoUrl?: string | null;
  riskLevel: RiskLevel;
  status: "open" | "in_progress" | "closed";
  anonymous: boolean;
  createdAt: string;
  assignedTo?: string | null;
  actionTaken?: string | null;
}

export type ObservationStatus = "ok" | "not_ok" | "na";

export interface ObservationItem {
  category: string;
  status: ObservationStatus;
  comment: string;
  photoUrl?: string | null;
}

export interface ObservationRound {
  id: string;
  companyId: string;
  observerId: string;
  departmentId: string;
  roundDate: string;
  roundTime: string;
  location: string;
  observations: ObservationItem[];
  overallScore: number;
  followUpRequired: boolean;
  notes: string;
  createdAt: string;
}

export interface DepartmentMetric {
  departmentId: string;
  departmentName: string;
  incidents: number;
  proactiveReports: number;
  observationIssues: number;
  riskScore: number;
}

export interface MonthlyTrendPoint {
  month: string;
  incidents: number;
  proactiveReports: number;
  proactiveRatio: number;
}

export interface ParetoPoint {
  name: string;
  count: number;
  cumulative: number;
}

export interface HseAnalyticsSnapshot {
  id: string;
  companyId: string;
  periodYear: number;
  periodMonth: number;
  totalIncidents: number;
  incidentsBySeverity: Record<SeverityLevel, number>;
  totalProactiveReports: number;
  observationRoundsCount: number;
  measureCompletionRate: number;
  overdueMeasuresRate: number;
  proactiveReactiveRatio: number;
  muopoBreakdown: Record<MuopoCategory, number>;
  departmentRiskRanking: DepartmentMetric[];
  rootCausePareto: ParetoPoint[];
  monthlyTrend: MonthlyTrendPoint[];
  aiInsights: string;
  generatedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  companyId: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  createdAt: string;
}

export interface PlatformTenantSummary {
  companyId: string;
  companyName: string;
  country: string;
  industry: string;
  subscriptionPlan: Company["subscriptionPlan"];
  activeUsers: number;
  incidentsThisMonth: number;
  highSeverityIncidents: number;
  openMeasures: number;
  overdueMeasures: number;
  proactiveReports: number;
  observationRounds: number;
  storageGb: number;
  rlsStatus: "enforced" | "review_required";
  healthScore: number;
}

export interface PlatformHealthCheck {
  name: string;
  status: "ok" | "warning" | "critical";
  detail: string;
}

export interface ReleaseReadinessCheck {
  area: "environment" | "security" | "data" | "notifications" | "ai" | "pwa" | "reporting";
  name: string;
  status: "ready" | "needs_config" | "blocked";
  detail: string;
  action: string;
}

export interface ReleaseReadinessSummary {
  ready: number;
  needsConfig: number;
  blocked: number;
  checks: ReleaseReadinessCheck[];
}
