import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_MODEL, getAnthropicClient, languageNames } from "@/lib/ai/claude";
import type { AnalysisFinding, Incident, Locale, Measure } from "@/lib/types";

const narrativeSchema = z.object({
  executiveSummary: z.string(),
  lessonsLearned: z.array(z.string()),
});

export interface ReportNarrative {
  executiveSummary: string;
  lessonsLearned: string[];
  aiGenerated: boolean;
}

/**
 * Generates the report-quality narrative sections (executive summary and
 * lessons learned) for an incident report. Falls back to data-derived text
 * when no API key is configured or the call fails.
 */
export async function generateReportNarrative(input: {
  incident: Incident;
  finding: AnalysisFinding;
  measures: Measure[];
  language: Locale;
}): Promise<ReportNarrative> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackNarrative(input);
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 2500,
      system: `You are an expert HSE report writer producing sections of a formal incident investigation report for company management and authorities.

executiveSummary:
- One paragraph of 4 to 6 sentences: what happened, the actual and credible worst-case consequences, the essence of the root causes, and the state of the corrective measures.
- Factual and precise; suitable for a director who reads nothing else.

lessonsLearned:
- 3 to 5 lessons that are specific to this incident, transferable to similar operations, and actionable. Each lesson is one or two sentences.

Base everything strictly on the provided facts; never invent details. Write in ${languageNames[input.language]} using correct HSE terminology.`,
      messages: [
        {
          role: "user",
          content: `INCIDENT: ${input.incident.title} (${input.incident.referenceNumber})
DATE: ${input.incident.incidentDate} ${input.incident.incidentTime} | LOCATION: ${input.incident.location}
SEVERITY: ${input.incident.severityLevel} (${input.incident.severityRationale})
PSE: ${input.incident.isPse} | VICTIM: ${input.incident.isVictim} | INJURY: ${input.incident.injuryLocation ?? "none"}
STATUS: ${input.incident.status}

DESCRIPTION
${input.incident.description}

FINDINGS
Direct causes: ${input.finding.directCauses.join("; ")}
Underlying causes: ${input.finding.underlyingCauses.join("; ")}
Root causes: ${input.finding.rootCauses.join("; ")}
Contributing factors: ${input.finding.contributingFactors.join("; ")}

MEASURES
${input.measures.map((measure) => `- [${measure.muopoCategory}] ${measure.description} (${measure.priority}, due ${measure.dueDate}, ${measure.status})`).join("\n") || "None recorded."}

Write the executive summary and lessons learned now.`,
        },
      ],
      output_config: {
        format: zodOutputFormat(narrativeSchema),
      },
    });

    if (response.parsed_output && response.parsed_output.executiveSummary) {
      return { ...response.parsed_output, aiGenerated: true };
    }
  } catch {
    // Fall through to the data-derived fallback below.
  }

  return buildFallbackNarrative(input);
}

const fallbackSummaryTemplates: Record<Locale, (input: { incident: Incident; finding: AnalysisFinding; measures: Measure[] }) => string> = {
  nl: ({ incident, finding, measures }) =>
    `${incident.title}. Ernst ${incident.severityLevel}.${incident.isPse ? " Dit incident is aangemerkt als Process Safety Event." : ""} Het onderzoek identificeerde ${finding.rootCauses.length} basisoorza(a)k(en) en ${measures.length} corrigerende of preventieve maatregel(en).`,
  en: ({ incident, finding, measures }) =>
    `${incident.title}. Severity ${incident.severityLevel}.${incident.isPse ? " This incident is flagged as a Process Safety Event." : ""} The investigation identified ${finding.rootCauses.length} root cause(s) and ${measures.length} corrective or preventive measure(s).`,
  fr: ({ incident, finding, measures }) =>
    `${incident.title}. Gravité ${incident.severityLevel}.${incident.isPse ? " Cet incident est classé comme événement de sécurité des procédés (PSE)." : ""} L'enquête a identifié ${finding.rootCauses.length} cause(s) racine(s) et ${measures.length} mesure(s) corrective(s) ou préventive(s).`,
};

const fallbackLessonTemplates: Record<Locale, (rootCause: string) => string> = {
  nl: (rootCause) => `Borg structureel dat de volgende systeemzwakte wordt beheerst: ${rootCause}`,
  en: (rootCause) => `Ensure the organisation structurally controls the following system weakness: ${rootCause}`,
  fr: (rootCause) => `Veiller à ce que l'organisation maîtrise structurellement la faiblesse systémique suivante : ${rootCause}`,
};

function buildFallbackNarrative(input: {
  incident: Incident;
  finding: AnalysisFinding;
  measures: Measure[];
  language: Locale;
}): ReportNarrative {
  return {
    executiveSummary: fallbackSummaryTemplates[input.language](input),
    lessonsLearned: input.finding.rootCauses.map((rootCause) => fallbackLessonTemplates[input.language](rootCause)),
    aiGenerated: false,
  };
}
