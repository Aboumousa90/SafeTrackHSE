import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  ANALYSIS_MODEL,
  analysisFindingSchema,
  buildSynthesisPrompt,
  getAnthropicClient,
  rootCauseRequestSchema,
} from "@/lib/ai/claude";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";
import type { AnalysisFinding, Locale } from "@/lib/types";

const demoFindings: Record<Locale, AnalysisFinding> = {
  nl: {
    directCauses: ["De slangkoppeling was niet volledig vergrendeld", "De operator stond binnen de spat- of blootstellingszone"],
    underlyingCauses: [
      "De controle voor gebruik vereiste geen trekproef op de koppeling",
      "De werkinstructie voor transfer beschreef de verificatie van tijdelijke slangen onvoldoende",
    ],
    rootCauses: [
      "De onderhoudscriteria voor vervanging van transferkoppelingen waren onvolledig",
      "Leidinggevende verificatie van tijdelijke chemische transfers was inconsistent",
    ],
    contributingFactors: ["Tijdsdruk bij batchstart", "Gelaatsscherm was beschikbaar maar niet gedragen bij de eerste aansluiting"],
  },
  en: {
    directCauses: ["Hose coupling was not fully locked", "Operator was positioned inside the splash zone"],
    underlyingCauses: [
      "The pre-use inspection did not require a coupling tug test",
      "The transfer SOP did not define temporary hose verification",
    ],
    rootCauses: [
      "Maintenance replacement criteria for transfer hose couplings were incomplete",
      "Supervisory verification of temporary chemical transfer setups was inconsistent",
    ],
    contributingFactors: ["Batch start time pressure", "Face shield was available but not worn during initial connection"],
  },
  fr: {
    directCauses: ["Le raccord du flexible n'était pas complètement verrouillé", "L'opérateur se trouvait dans la zone d'éclaboussure"],
    underlyingCauses: [
      "Le contrôle avant utilisation n'imposait pas de test de traction du raccord",
      "La procédure de transfert ne définissait pas assez la vérification des flexibles temporaires",
    ],
    rootCauses: [
      "Les critères de remplacement des raccords de transfert étaient incomplets",
      "La vérification par la supervision des montages temporaires de transfert chimique était inconstante",
    ],
    contributingFactors: ["Pression temporelle au démarrage du lot", "L'écran facial était disponible mais non porté lors du raccordement initial"],
  },
};

export async function POST(request: Request) {
  const parsed = rootCauseRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ finding: demoFindings[parsed.data.language], demoMode: true });
  }

  await requireTenantCompanyId();

  const transcript = parsed.data.messages
    .map((message) => `${message.role === "assistant" ? "FACILITATOR" : "INVESTIGATOR"}: ${message.content}`)
    .join("\n\n");

  const client = getAnthropicClient();
  const response = await client.messages.parse({
    model: ANALYSIS_MODEL,
    max_tokens: 3000,
    system: buildSynthesisPrompt({
      incidentDescription: parsed.data.incident.description,
      incidentDate: parsed.data.incident.date,
      department: parsed.data.incident.department,
      severityLevel: parsed.data.incident.severityLevel,
      isPse: parsed.data.incident.isPse,
      isVictim: parsed.data.incident.isVictim,
      injuryLocation: parsed.data.incident.injuryLocation,
      selectedMethod: parsed.data.method,
      language: parsed.data.language,
    }),
    messages: [
      {
        role: "user",
        content: `Interview transcript:\n\n${transcript}\n\nSynthesise the structured findings now.`,
      },
    ],
    output_config: {
      format: zodOutputFormat(analysisFindingSchema),
    },
  });

  if (!response.parsed_output) {
    return NextResponse.json({ error: "Synthesis did not produce structured findings" }, { status: 502 });
  }

  return NextResponse.json({ finding: response.parsed_output });
}
