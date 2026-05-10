import type { AnalysisFinding, Locale, MuopoCategory, SuggestedMeasure } from "@/lib/types";

const templates: Array<{
  category: MuopoCategory;
  priority: SuggestedMeasure["priority"];
  effort: SuggestedMeasure["estimatedEffort"];
  action: Record<Locale, (rootCause: string) => string>;
  role: Record<Locale, string>;
}> = [
  {
    category: "P",
    priority: "short_term",
    effort: "medium",
    role: { nl: "HSE-manager", en: "HSE Manager", fr: "Responsable HSE" },
    action: {
      nl: (rootCause) => `Werk de relevante SOP en controlelijst voor gebruik bij om deze oorzaak direct te beheersen: ${rootCause}.`,
      en: (rootCause) => `Update the relevant SOP and pre-use checklist to directly address: ${rootCause}.`,
      fr: (rootCause) => `Mettre a jour la procedure et la checklist avant utilisation pour traiter directement cette cause : ${rootCause}.`,
    },
  },
  {
    category: "U",
    priority: "immediate",
    effort: "medium",
    role: { nl: "Onderhoudssupervisor", en: "Maintenance Supervisor", fr: "Superviseur maintenance" },
    action: {
      nl: (rootCause) => `Inspecteer en vervang uitrusting of beveiligingen die verband houden met: ${rootCause}.`,
      en: (rootCause) => `Inspect and replace equipment or safeguards connected to: ${rootCause}.`,
      fr: (rootCause) => `Inspecter et remplacer les equipements ou protections lies a : ${rootCause}.`,
    },
  },
  {
    category: "M",
    priority: "short_term",
    effort: "low",
    role: { nl: "Leidinggevende", en: "Supervisor", fr: "Superviseur" },
    action: {
      nl: (rootCause) => `Organiseer een toolboxmeeting en competentiecheck gericht op: ${rootCause}.`,
      en: (rootCause) => `Run a toolbox talk and competence check focused on: ${rootCause}.`,
      fr: (rootCause) => `Organiser un quart d'heure securite et une verification de competence axes sur : ${rootCause}.`,
    },
  },
  {
    category: "O2",
    priority: "long_term",
    effort: "high",
    role: { nl: "Bedrijfsbeheerder", en: "Company Admin", fr: "Administrateur entreprise" },
    action: {
      nl: (rootCause) => `Voeg managementsysteemverificatie en periodiek auditeigenaarschap toe voor: ${rootCause}.`,
      en: (rootCause) => `Add management-system verification and recurring audit ownership for: ${rootCause}.`,
      fr: (rootCause) => `Ajouter une verification du systeme de management et une responsabilite d'audit recurrente pour : ${rootCause}.`,
    },
  },
];

export function generateMuopoSuggestions(incidentId: string, finding: AnalysisFinding, locale: Locale = "nl"): SuggestedMeasure[] {
  return finding.rootCauses.flatMap((rootCause, rootIndex) =>
    templates.map((template, templateIndex) => ({
      id: `${incidentId}-${rootIndex + 1}-${template.category}-${templateIndex + 1}`,
      incidentId,
      rootCause,
      muopoCategory: template.category,
      description: template.action[locale](rootCause),
      priority: template.priority,
      suggestedResponsibleRole: template.role[locale],
      estimatedEffort: template.effort,
    })),
  );
}
