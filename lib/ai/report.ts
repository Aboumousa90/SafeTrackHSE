import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_MODEL, getAnthropicClient, languageNames } from "@/lib/ai/claude";
import type { AnalysisFinding, Incident, Locale, Measure } from "@/lib/types";

const lessonsSchema = z.object({
  lessonsLearned: z.array(z.string()),
});

/**
 * Generates incident-specific lessons learned for the report. Falls back to
 * findings-derived statements when no API key is configured or the call fails.
 */
export async function generateLessonsLearned(input: {
  incident: Incident;
  finding: AnalysisFinding;
  measures: Measure[];
  language: Locale;
}): Promise<{ lessons: string[]; aiGenerated: boolean }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { lessons: deriveFallbackLessons(input.finding, input.language), aiGenerated: false };
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.parse({
      model: ANALYSIS_MODEL,
      max_tokens: 1500,
      system: `You are an expert HSE report writer. Write the "Lessons Learned" section of a formal incident investigation report. Produce 3 to 5 lessons that are specific to this incident, transferable to similar operations, and actionable. Each lesson is one or two sentences. Write in ${languageNames[input.language]} using correct HSE terminology. Base the lessons strictly on the provided facts; do not invent details.`,
      messages: [
        {
          role: "user",
          content: `INCIDENT: ${input.incident.title}
DESCRIPTION: ${input.incident.description}
SEVERITY: ${input.incident.severityLevel} | PSE: ${input.incident.isPse} | VICTIM: ${input.incident.isVictim}

FINDINGS
Direct causes: ${input.finding.directCauses.join("; ")}
Underlying causes: ${input.finding.underlyingCauses.join("; ")}
Root causes: ${input.finding.rootCauses.join("; ")}
Contributing factors: ${input.finding.contributingFactors.join("; ")}

MEASURES
${input.measures.map((measure) => `- [${measure.muopoCategory}] ${measure.description} (${measure.priority}, ${measure.status})`).join("\n") || "None recorded."}

Write the lessons learned now.`,
        },
      ],
      output_config: {
        format: zodOutputFormat(lessonsSchema),
      },
    });

    if (response.parsed_output && response.parsed_output.lessonsLearned.length > 0) {
      return { lessons: response.parsed_output.lessonsLearned, aiGenerated: true };
    }
  } catch {
    // Fall through to the findings-derived fallback below.
  }

  return { lessons: deriveFallbackLessons(input.finding, input.language), aiGenerated: false };
}

const fallbackTemplates: Record<Locale, (rootCause: string) => string> = {
  nl: (rootCause) => `Borg structureel dat de volgende systeemzwakte wordt beheerst: ${rootCause}`,
  en: (rootCause) => `Ensure the organisation structurally controls the following system weakness: ${rootCause}`,
  fr: (rootCause) => `Veiller à ce que l'organisation maîtrise structurellement la faiblesse systémique suivante : ${rootCause}`,
};

function deriveFallbackLessons(finding: AnalysisFinding, language: Locale): string[] {
  const lessons = finding.rootCauses.map((rootCause) => fallbackTemplates[language](rootCause));
  return lessons.length > 0 ? lessons : [];
}
