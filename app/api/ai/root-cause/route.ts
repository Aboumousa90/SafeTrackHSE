import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { executeRcaTool, rcaTools } from "@/lib/ai/rca-tools";
import {
  ANALYSIS_COMPLETE_MARKER,
  buildRootCauseSystemBlocks,
  CHAT_MODEL,
  getAnthropicClient,
  normalizeConversation,
  rootCauseRequestSchema,
} from "@/lib/ai/claude";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

function textResponse(content: string, headers: Record<string, string>) {
  return new Response(content, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...headers },
  });
}

export async function POST(request: Request) {
  const parsed = rootCauseRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = await resolveUserId();
  const rate = await checkAiRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json({ error: "AI rate limit exceeded" }, { status: 429 });
  }

  const rateHeaders = { "X-RateLimit-Remaining": String(rate.remaining) };

  if (!process.env.ANTHROPIC_API_KEY) {
    const reply = createFallbackReply(parsed.data.method, parsed.data.messages.length, parsed.data.language);
    return textResponse(reply, { ...rateHeaders, "X-SafeTrack-Demo": "1" });
  }

  await requireTenantCompanyId();

  const client = getAnthropicClient();
  const system = buildRootCauseSystemBlocks({
    incidentDescription: parsed.data.incident.description,
    incidentDate: parsed.data.incident.date,
    department: parsed.data.incident.department,
    severityLevel: parsed.data.incident.severityLevel,
    isPse: parsed.data.incident.isPse,
    isVictim: parsed.data.incident.isVictim,
    injuryLocation: parsed.data.incident.injuryLocation,
    selectedMethod: parsed.data.method,
    language: parsed.data.language,
  });

  const encoder = new TextEncoder();
  let cancelled = false;
  const maxToolTurns = 5;

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let conversation: Anthropic.MessageParam[] = normalizeConversation(parsed.data.messages, parsed.data.language);

        for (let turn = 0; turn < maxToolTurns && !cancelled; turn++) {
          const stream = client.messages.stream({
            model: CHAT_MODEL,
            max_tokens: 2000,
            system,
            tools: rcaTools,
            messages: conversation,
          });

          let emittedText = false;
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(event.delta.text));
              emittedText = true;
            }
          }

          const finalMessage = await stream.finalMessage();
          if (finalMessage.stop_reason !== "tool_use") break;

          const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
            finalMessage.content
              .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
              .map(async (toolUse) => ({
                type: "tool_result" as const,
                tool_use_id: toolUse.id,
                content: await executeRcaTool(toolUse.name, toolUse.input),
              })),
          );

          conversation = [
            ...conversation,
            { role: "assistant", content: finalMessage.content },
            { role: "user", content: toolResults },
          ];

          if (emittedText) {
            controller.enqueue(encoder.encode("\n\n"));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...rateHeaders,
      "X-SafeTrack-Demo": "0",
    },
  });
}

async function resolveUserId() {
  if (!isSupabaseConfigured()) {
    return "demo-user";
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? "anonymous";
}

function createFallbackReply(
  method: z.infer<typeof rootCauseRequestSchema>["method"],
  messageCount: number,
  language: z.infer<typeof rootCauseRequestSchema>["language"],
) {
  if (messageCount >= 7) {
    const completed: Record<typeof language, string> = {
      nl: `${ANALYSIS_COMPLETE_MARKER}
De directe oorzaken zijn een niet volledig vergrendelde slangkoppeling en een operator binnen de spatzone. Onderliggend ontbraken een trekproef in de controle voor gebruik en een duidelijke verificatie van tijdelijke slangen in de werkinstructie. De basisoorzaken liggen in onvolledige vervangingscriteria voor transferkoppelingen en inconsistente verificatie van tijdelijke transfers door leidinggevenden. Tijdsdruk bij batchstart en het niet dragen van het beschikbare gelaatsscherm droegen bij.`,
      en: `${ANALYSIS_COMPLETE_MARKER}
The direct causes are a hose coupling that was not fully locked and an operator positioned inside the splash zone. Underlying this, the pre-use inspection did not require a coupling tug test and the transfer SOP did not define temporary hose verification. The root causes are incomplete maintenance replacement criteria for transfer hose couplings and inconsistent supervisory verification of temporary chemical transfer setups. Batch start time pressure and the face shield not being worn during initial connection were contributing factors.`,
      fr: `${ANALYSIS_COMPLETE_MARKER}
Les causes directes sont un raccord de flexible incomplètement verrouillé et un opérateur positionné dans la zone d'éclaboussure. En sous-jacent, le contrôle avant utilisation n'imposait pas de test de traction et la procédure de transfert ne définissait pas la vérification des flexibles temporaires. Les causes racines sont des critères de remplacement incomplets pour les raccords de transfert et une vérification inconstante des montages temporaires par la supervision. La pression temporelle au démarrage du lot et le non-port de l'écran facial disponible ont contribué.`,
    };
    return completed[language];
  }

  const prompts: Record<typeof language, Record<typeof method, string[]>> = {
    nl: {
      "5why": [
        "Waarom is de koppeling tijdens de transfer losgekomen?",
        "Waarom is de verwachte verificatiestap niet uitgevoerd?",
        "Waarom bevatte de SOP die verificatiestap niet?",
      ],
      fishbone: [
        "Welke procedure had binnen de tak Methode deze vrijzetting moeten voorkomen?",
        "Wat was binnen de tak Uitrusting de staat van de slang en vergrendelnokken?",
        "Hoe vaak worden tijdelijke transferopstellingen door leidinggevenden gecontroleerd?",
      ],
      fmea: [
        "Welke functie faalde als eerste: inperking, verbindingsintegriteit, inspectie of positionering van de operator?",
        "Welke scores voor ernst, optreden en detectie zou je toekennen aan het loskomen van de koppeling?",
        "Welke beheersmaatregel verlaagt de RPN het meest?",
      ],
      pareto: [
        "Welke oorzaakcategorie komt het vaakst terug in vergelijkbare gebeurtenissen?",
        "Hoeveel vergelijkbare transferincidenten betroffen procedurele tekortkomingen?",
        "Welke oorzaakcategorie moet eerst worden aangepakt voor de grootste risicoreductie?",
      ],
      fault_tree: [
        "Welke topgebeurtenis plaatsen we bovenaan de foutenboom?",
        "Ontstond de vrijzetting door een EN-combinatie van koppelingsfalen en blootstelling, of door een van beide afzonderlijk?",
        "Welke basisgebeurtenissen horen onder de tak koppelingsfalen?",
      ],
      scatter: [
        "Welke twee variabelen moeten we vergelijken voor correlatie?",
        "Verklaren blootstellingsuren, aantal transfers of achterstallige inspecties het patroon het best?",
        "Welke datapunten moeten als uitschieters worden uitgesloten?",
      ],
    },
    en: {
      "5why": [
        "Why did the coupling loosen during the transfer?",
        "Why was the expected verification step not performed?",
        "Why did the SOP not include that verification step?",
      ],
      fishbone: [
        "For the Method branch, what procedure should have prevented this release?",
        "For the Machine branch, what was the condition of the hose and locking tabs?",
        "For the Management branch, how often are temporary transfer setups verified?",
      ],
      fmea: [
        "Which function failed first: containment, connection integrity, inspection, or operator positioning?",
        "What severity, occurrence, and detection scores would you assign to coupling release?",
        "Which control would most reduce the RPN?",
      ],
      pareto: [
        "Across similar events, which cause category appears most often?",
        "How many comparable transfer incidents involved procedure gaps?",
        "Which cause category should be addressed first for the largest risk reduction?",
      ],
      fault_tree: [
        "What top event should we place at the head of the fault tree?",
        "Was the release caused by an AND combination of coupling failure and exposure, or either event alone?",
        "Which basic events sit below the coupling failure branch?",
      ],
      scatter: [
        "Which two variables should we compare for correlation?",
        "Do exposure hours, number of transfers, or overdue inspections best explain the pattern?",
        "What data points should be excluded as outliers?",
      ],
    },
    fr: {
      "5why": [
        "Pourquoi le raccord s'est-il desserré pendant le transfert ?",
        "Pourquoi l'étape de vérification attendue n'a-t-elle pas été réalisée ?",
        "Pourquoi la procédure ne contenait-elle pas cette étape de vérification ?",
      ],
      fishbone: [
        "Pour la branche Méthode, quelle procédure aurait dû prévenir ce rejet ?",
        "Pour la branche Équipement, quel était l'état du flexible et des ergots de verrouillage ?",
        "À quelle fréquence les montages temporaires de transfert sont-ils vérifiés par la supervision ?",
      ],
      fmea: [
        "Quelle fonction a échoué en premier : confinement, intégrité du raccord, inspection ou positionnement de l'opérateur ?",
        "Quels scores de gravité, occurrence et détection attribueriez-vous au desserrage du raccord ?",
        "Quelle mesure de maîtrise réduirait le plus le RPN ?",
      ],
      pareto: [
        "Dans les événements similaires, quelle catégorie de cause revient le plus souvent ?",
        "Combien d'incidents de transfert comparables impliquaient des lacunes de procédure ?",
        "Quelle catégorie de cause faut-il traiter en premier pour réduire le risque au maximum ?",
      ],
      fault_tree: [
        "Quel événement sommet devons-nous placer en haut de l'arbre des défaillances ?",
        "Le rejet est-il dû à une combinaison ET entre défaillance du raccord et exposition, ou à l'un des deux seuls ?",
        "Quels événements de base se trouvent sous la branche défaillance du raccord ?",
      ],
      scatter: [
        "Quelles deux variables devons-nous comparer pour rechercher une corrélation ?",
        "Les heures d'exposition, le nombre de transferts ou les inspections en retard expliquent-ils le mieux le schéma ?",
        "Quels points de données doivent être exclus comme valeurs aberrantes ?",
      ],
    },
  };

  const index = Math.min(Math.floor(messageCount / 2), prompts[language][method].length - 1);
  return prompts[language][method][index];
}
