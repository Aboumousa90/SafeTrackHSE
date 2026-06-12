import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_MODEL, getAnthropicClient, languageNames } from "@/lib/ai/claude";
import type { Locale } from "@/lib/types";

export const intakeSuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  location: z.string(),
  eventCategory: z.enum(["injury", "near-miss", "property damage", "environmental", "process safety"]),
  suggestedSeverity: z.enum(["S1", "S2", "S3", "S4", "S5"]),
  severityRationale: z.string(),
  observedHazards: z.array(z.string()),
  pseLikely: z.boolean(),
});

export type IntakeSuggestion = z.infer<typeof intakeSuggestionSchema>;

export type IntakeImageMediaType = "image/jpeg" | "image/png" | "image/webp";

/**
 * Analyses an incident photo (plus an optional note from the reporter) and
 * returns structured prefill suggestions for the incident wizard.
 */
export async function analyzeIncidentPhoto(input: {
  imageBase64: string;
  mediaType: IntakeImageMediaType;
  note?: string;
  language: Locale;
}): Promise<IntakeSuggestion> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 2000,
    system: `You are an experienced HSE professional helping a shop-floor employee report an incident. You receive a photo of the scene and possibly a short note from the reporter. Extract everything the photo and note support, so the employee only has to verify and complete the form.

Rules:
- title: a short factual incident title (max 10 words).
- description: a factual scene description of what is visible and what likely happened. Only describe what the photo and note support; never invent injuries, substances, or events you cannot see. Make it usable as the start of an incident report (aim for 100+ characters).
- location: the type of work area visible (for example loading dock, warehouse aisle, production line); empty string if unclear.
- eventCategory: the most plausible category.
- suggestedSeverity: S1 is the most severe, S5 the least. Judge the credible worst-case potential of what is visible, and explain that judgement in severityRationale.
- observedHazards: each distinct hazard visible in the photo, as short phrases.
- pseLikely: true only if the scene credibly involves a loss of containment of a hazardous substance.
- Write all text values in ${languageNames[input.language]} using plain, jargon-free wording a shop-floor employee can verify.`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 },
          },
          {
            type: "text",
            text: input.note?.trim()
              ? `Reporter's note: ${input.note.trim()}\n\nAnalyse the photo and the note, then fill the incident form fields.`
              : "Analyse the photo and fill the incident form fields.",
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(intakeSuggestionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("Photo intake returned no structured output");
  }

  return response.parsed_output;
}

export const demoIntakeSuggestions: Record<Locale, IntakeSuggestion> = {
  nl: {
    title: "Lekkage bij tijdelijke slangverbinding",
    description:
      "Op de foto is een tijdelijke slangverbinding zichtbaar met vloeistofsporen op de vloer eronder. De omgeving is een procesinstallatie met leidingwerk; er staat geen opvangbak onder de verbinding en er is geen afzetting rond de plas.",
    location: "Procesinstallatie",
    eventCategory: "process safety",
    suggestedSeverity: "S3",
    severityRationale: "Zichtbare lekkage van onbekende vloeistof zonder opvang of afzetting; het geloofwaardige worst-case scenario is blootstelling van een passerende medewerker.",
    observedHazards: ["Vloeistof op de vloer (uitglijden)", "Onbeschermde tijdelijke slangverbinding", "Geen afzetting rond de lekkage"],
    pseLikely: true,
  },
  en: {
    title: "Leak at temporary hose connection",
    description:
      "The photo shows a temporary hose connection with liquid traces on the floor below it. The area is a process installation with piping; there is no drip tray under the connection and no barrier around the spill.",
    location: "Process installation",
    eventCategory: "process safety",
    suggestedSeverity: "S3",
    severityRationale: "Visible leak of an unknown liquid without containment or barriers; the credible worst case is exposure of a passing employee.",
    observedHazards: ["Liquid on the floor (slip hazard)", "Unprotected temporary hose connection", "No barrier around the spill"],
    pseLikely: true,
  },
  fr: {
    title: "Fuite sur un raccord de flexible temporaire",
    description:
      "La photo montre un raccord de flexible temporaire avec des traces de liquide au sol en dessous. La zone est une installation de procédé avec tuyauteries ; il n'y a pas de bac de rétention sous le raccord ni de balisage autour de la flaque.",
    location: "Installation de procédé",
    eventCategory: "process safety",
    suggestedSeverity: "S3",
    severityRationale: "Fuite visible d'un liquide inconnu sans rétention ni balisage ; le pire scénario crédible est l'exposition d'un salarié de passage.",
    observedHazards: ["Liquide au sol (risque de glissade)", "Raccord temporaire non protégé", "Absence de balisage autour de la fuite"],
    pseLikely: true,
  },
};
