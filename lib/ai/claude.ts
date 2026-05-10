import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisMethod, Locale } from "@/lib/types";

export function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return new Anthropic({ apiKey });
}

export function buildRootCauseSystemPrompt(input: {
  incidentDescription: string;
  incidentDate: string;
  department: string;
  severityLevel: string;
  isPse: boolean;
  isVictim: boolean;
  injuryLocation: string | null;
  selectedMethod: AnalysisMethod;
  language: Locale;
}) {
  const languageName: Record<Locale, string> = {
    nl: "Dutch (Nederlands)",
    en: "English",
    fr: "French (francais)",
  };

  return `You are an expert HSE root cause analysis facilitator with 20+ years of experience in industrial safety, process safety, and occupational health. You are conducting a structured root cause analysis interview for the following incident:

INCIDENT: ${input.incidentDescription}
DATE: ${input.incidentDate} | DEPARTMENT: ${input.department} | SEVERITY: ${input.severityLevel}
PSE: ${input.isPse} | VICTIM: ${input.isVictim} | INJURY: ${input.injuryLocation ?? "none"}

Your method: ${input.selectedMethod}

Ask one focused question at a time. Build on previous answers. After gathering sufficient information, synthesise your findings into: direct causes, underlying causes, root causes, and contributing factors.

Language rule:
- Write the complete conversation and all explanatory output in ${languageName[input.language]}.
- Use correct HSE terminology for that language.
- Do not switch language unless the user explicitly asks.

When you have identified the root causes, clearly state: "ROOT CAUSE ANALYSIS COMPLETE" followed by structured JSON.
Keep the JSON property names exactly as: directCauses, underlyingCauses, rootCauses, contributingFactors.
Translate all JSON string values into ${languageName[input.language]}.`;
}
