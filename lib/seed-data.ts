import type {
  AnalysisFinding,
  Company,
  CompanyConfig,
  Department,
  Incident,
  Measure,
  ObservationRound,
  ProactiveReport,
  SeverityCell,
  TenantUser,
} from "@/lib/types";

export const company: Company = {
  id: "c-100",
  name: "SafeTrack Chemicals Belgium",
  logoUrl: "",
  industry: "Specialty chemicals",
  country: "BE",
  subscriptionPlan: "Enterprise",
};

export const users: TenantUser[] = [
  { id: "u-1", companyId: company.id, role: "hse_manager", fullName: "Elise Martens", email: "elise@safetrack.example", departmentId: "d-1", language: "nl" },
  { id: "u-2", companyId: company.id, role: "supervisor", fullName: "Karim Benali", email: "karim@safetrack.example", departmentId: "d-2", language: "nl" },
  { id: "u-3", companyId: company.id, role: "employee", fullName: "Marie Dubois", email: "marie@safetrack.example", departmentId: "d-3", language: "fr" },
];

export const departments: Department[] = [
  { id: "d-1", companyId: company.id, name: "HSE", managerId: "u-1" },
  { id: "d-2", companyId: company.id, name: "Production Line A", managerId: "u-2" },
  { id: "d-3", companyId: company.id, name: "Warehouse", managerId: "u-2" },
  { id: "d-4", companyId: company.id, name: "Maintenance", managerId: "u-1" },
];

export const severityMatrix: SeverityCell[] = Array.from({ length: 5 }).flatMap((_, likelihoodIndex) =>
  Array.from({ length: 5 }).map((__, consequenceIndex) => {
    const score = likelihoodIndex + consequenceIndex + 2;
    const level = score >= 9 ? "S1" : score >= 7 ? "S2" : score >= 5 ? "S3" : score >= 3 ? "S4" : "S5";
    return {
      likelihood: likelihoodIndex + 1,
      consequence: consequenceIndex + 1,
      level,
      label: `L${likelihoodIndex + 1} x C${consequenceIndex + 1}`,
    };
  }),
);

export const companyConfig: CompanyConfig = {
  id: "cfg-100",
  companyId: company.id,
  severityMatrix,
  corporatePseStandard: [
    { productClass: "Corrosive liquid", thresholdQuantity: 5, unit: "L", classification: "Tier 2 PSE review", consequenceArea: "Chemical exposure / environmental release" },
    { productClass: "Flammable liquid", thresholdQuantity: 10, unit: "L", classification: "Tier 1 PSE review", consequenceArea: "Fire and explosion" },
  ],
  notificationSettings: {
    newIncident: ["hse_manager", "supervisor"],
    escalatedSeverity: ["hse_manager", "company_admin"],
    overdueMeasure: ["hse_manager", "supervisor"],
    monthlyAnalytics: ["hse_manager", "company_admin"],
    proactiveHighRisk: ["hse_manager"],
  },
  reportTemplateUrl: null,
  slideTemplateUrl: null,
  footerText: "SafeTrack Chemicals Belgium - Internal HSE report",
  brandColor: "#1B4F72",
};

export const incidents: Incident[] = [
  {
    id: "i-1",
    companyId: company.id,
    referenceNumber: "INC-2026-STC-00042",
    title: "Chemical splash during transfer",
    description: "During manual transfer from an IBC to a reactor feed tank, a hose coupling loosened and released approximately 8 liters of caustic solution. The operator received a minor splash on the forearm while closing the valve.",
    incidentDate: "2026-05-02",
    incidentTime: "09:35",
    departmentId: "d-2",
    involvedPersonName: "Production operator",
    reporterId: "u-2",
    location: "Plant North",
    locationDetail: "Reactor feed bay",
    isVictim: true,
    injuryLocation: "Left forearm",
    severityLevel: "S2",
    severityRationale: "High consequence potential due to chemical exposure and uncontrolled release; actual injury limited by fast decontamination.",
    isPse: true,
    isUndesiredRelease: true,
    status: "in_analysis",
    createdAt: "2026-05-02T10:00:00Z",
  },
  {
    id: "i-2",
    companyId: company.id,
    referenceNumber: "INC-2026-STC-00043",
    title: "Forklift pedestrian near miss",
    description: "A forklift reversed from the loading dock without audible warning while a warehouse employee crossed the marked walkway. No contact occurred, but separation distance was less than one meter.",
    incidentDate: "2026-05-05",
    incidentTime: "14:20",
    departmentId: "d-3",
    involvedPersonName: "Warehouse employee",
    reporterId: "u-3",
    location: "Warehouse",
    locationDetail: "Dock 3",
    isVictim: false,
    injuryLocation: null,
    severityLevel: "S3",
    severityRationale: "Near miss with credible serious injury potential in a shared traffic zone.",
    isPse: false,
    isUndesiredRelease: false,
    status: "measures_defined",
    createdAt: "2026-05-05T15:00:00Z",
  },
];

export const analysisFinding: AnalysisFinding = {
  directCauses: ["Hose coupling was not fully locked", "Operator stood within the splash zone"],
  underlyingCauses: ["Pre-use inspection did not include a coupling tug test", "Transfer task risk assessment did not cover worn locking tabs"],
  rootCauses: ["Maintenance standard for transfer hoses lacked replacement criteria", "Supervisory verification of temporary transfer setups was inconsistent"],
  contributingFactors: ["Time pressure before batch start", "Face shield available but not worn during initial connection"],
};

export const measures: Measure[] = [
  { id: "m-1", incidentId: "i-1", muopoCategory: "U", description: "Replace all aged camlock couplings and add locking clips on caustic transfer hoses.", responsiblePersonId: "u-2", dueDate: "2026-05-12", priority: "immediate", status: "in_progress" },
  { id: "m-2", incidentId: "i-1", muopoCategory: "P", description: "Update transfer SOP with coupling tug test and splash-zone exclusion step.", responsiblePersonId: "u-1", dueDate: "2026-05-18", priority: "short_term", status: "open" },
  { id: "m-3", incidentId: "i-2", muopoCategory: "O", description: "Repaint pedestrian crossing and install convex mirror at dock 3 exit.", responsiblePersonId: "u-2", dueDate: "2026-05-10", priority: "immediate", status: "completed" },
  { id: "m-4", incidentId: "i-2", muopoCategory: "M", description: "Run toolbox talk on reversing discipline and pedestrian right-of-way.", responsiblePersonId: "u-2", dueDate: "2026-05-14", priority: "short_term", status: "verified" },
];

export const proactiveReports: ProactiveReport[] = [
  { id: "p-1", companyId: company.id, departmentId: "d-3", reporterId: null, reportType: "unsafe_condition", description: "Spill kit seal broken near dock 2.", location: "Warehouse", riskLevel: "medium", status: "open", anonymous: true, createdAt: "2026-05-07T08:00:00Z" },
  { id: "p-2", companyId: company.id, departmentId: "d-2", reporterId: "u-3", reportType: "positive_observation", description: "Operator stopped work and challenged missing permit before line break.", location: "Plant North", riskLevel: "low", status: "closed", anonymous: false, createdAt: "2026-05-08T11:00:00Z" },
];

export const observationRounds: ObservationRound[] = [
  {
    id: "o-1",
    companyId: company.id,
    observerId: "u-2",
    departmentId: "d-2",
    roundDate: "2026-05-06",
    roundTime: "09:15",
    location: "Plant North",
    observations: [
      { category: "PPE compliance", status: "ok", comment: "Operators wearing required eye and hand protection." },
      { category: "Housekeeping", status: "not_ok", comment: "Temporary hose left across marked walkway.", photoUrl: null },
    ],
    overallScore: 4,
    followUpRequired: true,
    notes: "Good engagement from shift team; one walkway issue requires follow-up.",
    createdAt: "2026-05-06T09:45:00Z",
  },
  {
    id: "o-2",
    companyId: company.id,
    observerId: "u-1",
    departmentId: "d-3",
    roundDate: "2026-05-08",
    roundTime: "13:30",
    location: "Warehouse",
    observations: [
      { category: "Machine guarding", status: "na", comment: "No fixed machinery in inspected aisle." },
      { category: "Emergency equipment", status: "not_ok", comment: "Spill kit seal missing near dock 2.", photoUrl: null },
    ],
    overallScore: 3,
    followUpRequired: true,
    notes: "Emergency equipment checks need tighter ownership.",
    createdAt: "2026-05-08T14:05:00Z",
  },
];
