import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_MODEL, getAnthropicClient, languageNames } from "@/lib/ai/claude";
import type { AnalysisFinding, Locale, SuggestedMeasure } from "@/lib/types";

const suggestedMeasureSchema = z.object({
  measures: z.array(
    z.object({
      rootCause: z.string(),
      muopoCategory: z.enum(["M", "U", "O", "P", "O2"]),
      description: z.string(),
      priority: z.enum(["immediate", "short_term", "long_term"]),
      suggestedResponsibleRole: z.string(),
      estimatedEffort: z.enum(["low", "medium", "high"]),
    }),
  ),
});

/**
 * Generates incident-specific MUOPO measure suggestions with Claude.
 * Throws when no API key is configured — callers decide the fallback.
 */
export async function generateAiMeasureSuggestions(input: {
  incidentId: string;
  incidentDescription?: string;
  finding: AnalysisFinding;
  language: Locale;
}): Promise<SuggestedMeasure[]> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 4000,
    system: `You are an expert HSE advisor designing corrective and preventive actions after an incident investigation.

Rules:
- Propose 2 to 4 measures per root cause. Every measure must address its specific root cause — no generic boilerplate.
- Apply the hierarchy of controls: prefer elimination and engineering controls over procedural controls, and procedural controls over instruction or PPE. Reflect this in the priority you assign.
- Assign each measure a MUOPO category: M = Mens/People (competence, behaviour, supervision), U = Uitrusting/Equipment (technical and engineering controls), O = Omgeving/Environment (workplace, layout, housekeeping), P = Procedure (SOPs, checklists, work instructions), O2 = Organisatie/Management system (audits, ownership, management review).
- priority: "immediate" for measures that remove an active danger, "short_term" for measures achievable within weeks, "long_term" for system changes.
- suggestedResponsibleRole: a realistic job role (for example HSE manager, maintenance supervisor, line supervisor), not a person's name.
- Echo each measure's rootCause field exactly as given in the input list.
- Write description and suggestedResponsibleRole in ${languageNames[input.language]} using correct HSE terminology.`,
    messages: [
      {
        role: "user",
        content: `${input.incidentDescription ? `INCIDENT: ${input.incidentDescription}\n\n` : ""}FINDINGS
Direct causes: ${input.finding.directCauses.join("; ")}
Underlying causes: ${input.finding.underlyingCauses.join("; ")}
Root causes:
${input.finding.rootCauses.map((cause, index) => `${index + 1}. ${cause}`).join("\n")}
Contributing factors: ${input.finding.contributingFactors.join("; ")}

Propose the MUOPO measures now.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(suggestedMeasureSchema),
    },
  });

  if (!response.parsed_output || response.parsed_output.measures.length === 0) {
    throw new Error("AI measure suggestion returned no structured output");
  }

  return response.parsed_output.measures.map((measure, index) => ({
    id: `${input.incidentId}-ai-${index + 1}`,
    incidentId: input.incidentId,
    ...measure,
  }));
}
