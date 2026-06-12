import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ANALYSIS_COMPLETE_MARKER } from "@/lib/ai/constants";
import type { AnalysisMethod, Locale } from "@/lib/types";

/** Fast, cost-efficient model for the interactive analysis interview. */
export const CHAT_MODEL = "claude-sonnet-4-6";
/** Most capable model for synthesis and report-quality generation. */
export const ANALYSIS_MODEL = "claude-opus-4-8";

export { ANALYSIS_COMPLETE_MARKER };

export const languageNames: Record<Locale, string> = {
  nl: "Dutch (Nederlands)",
  en: "English",
  fr: "French (français)",
};

export const rootCauseRequestSchema = z.object({
  language: z.enum(["nl", "en", "fr"]),
  method: z.enum(["5why", "fishbone", "fmea", "pareto", "fault_tree", "scatter"]),
  incident: z.object({
    description: z.string().min(20),
    date: z.string(),
    department: z.string(),
    severityLevel: z.string(),
    isPse: z.boolean(),
    isVictim: z.boolean(),
    injuryLocation: z.string().nullable(),
  }),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
});

export const analysisFindingSchema = z.object({
  directCauses: z.array(z.string()),
  underlyingCauses: z.array(z.string()),
  rootCauses: z.array(z.string()),
  contributingFactors: z.array(z.string()),
});

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey });
}

export interface RootCauseContext {
  incidentDescription: string;
  incidentDate: string;
  department: string;
  severityLevel: string;
  isPse: boolean;
  isVictim: boolean;
  injuryLocation: string | null;
  selectedMethod: AnalysisMethod;
  language: Locale;
}

export function buildRootCauseSystemBlocks(input: RootCauseContext): Anthropic.TextBlockParam[] {
  // Stable facilitator instructions first (cacheable prefix), volatile incident context after.
  const facilitator = `You are an expert HSE root cause analysis facilitator with 20+ years of experience in industrial safety, process safety, and occupational health. You conduct structured root cause analysis interviews.

Interview style:
- Ask one focused question at a time and build on previous answers.
- Adapt your questions to the selected analysis method.
- Your audience includes shop-floor employees: keep questions short, concrete, and free of jargon.

Completion rule:
- After gathering sufficient information, state exactly: "${ANALYSIS_COMPLETE_MARKER}" on its own line, followed by a short prose summary of the direct causes, underlying causes, root causes, and contributing factors.
- Do not output JSON or code blocks in the conversation.`;

  const context = `INCIDENT: ${input.incidentDescription}
DATE: ${input.incidentDate} | DEPARTMENT: ${input.department} | SEVERITY: ${input.severityLevel}
PSE: ${input.isPse} | VICTIM: ${input.isVictim} | INJURY: ${input.injuryLocation ?? "none"}

Your method: ${input.selectedMethod}

Language rule:
- Write the complete conversation and all explanatory output in ${languageNames[input.language]}.
- Use correct HSE terminology for that language.
- Do not switch language unless the user explicitly asks.`;

  return [
    { type: "text", text: facilitator, cache_control: { type: "ephemeral" } },
    { type: "text", text: context },
  ];
}

export function buildSynthesisPrompt(input: RootCauseContext): string {
  return `You are an expert HSE root cause analyst. You receive the transcript of a completed root cause analysis interview (method: ${input.selectedMethod}) for this incident:

INCIDENT: ${input.incidentDescription}
DATE: ${input.incidentDate} | DEPARTMENT: ${input.department} | SEVERITY: ${input.severityLevel}
PSE: ${input.isPse} | VICTIM: ${input.isVictim} | INJURY: ${input.injuryLocation ?? "none"}

Synthesise the interview into structured findings. Distinguish carefully between direct causes (the immediate failure), underlying causes (process and procedural weaknesses), root causes (systemic management-system failures), and contributing factors (conditions that made the event more likely or worse). Base every item on the transcript; do not invent facts.

Write all values in ${languageNames[input.language]} using correct HSE terminology.`;
}

const KICKOFF_MESSAGE: Record<Locale, string> = {
  nl: "Start de oorzaakanalyse.",
  en: "Start the root cause analysis.",
  fr: "Commencez l'analyse des causes racines.",
};

/**
 * The API requires conversations to start with a user turn, but the workbench
 * opens with an assistant greeting. Prepend a kickoff turn when needed.
 */
export function normalizeConversation(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  language: Locale,
): Anthropic.MessageParam[] {
  if (messages.length === 0 || messages[0].role === "assistant") {
    return [{ role: "user", content: KICKOFF_MESSAGE[language] }, ...messages];
  }
  return messages;
}
