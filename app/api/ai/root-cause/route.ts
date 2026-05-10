import { NextResponse } from "next/server";
import { z } from "zod";
import { buildRootCauseSystemPrompt, getAnthropicClient } from "@/lib/ai/claude";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

const bodySchema = z.object({
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

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const userId = await resolveUserId();
  const rate = checkAiRateLimit(userId);
  if (!rate.allowed) {
    return NextResponse.json({ error: "AI rate limit exceeded" }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      content: createFallbackReply(parsed.data.method, parsed.data.messages.length, parsed.data.language),
      remaining: rate.remaining,
      demoMode: true,
    });
  }

  await requireTenantCompanyId();

  const client = getAnthropicClient();
  const system = buildRootCauseSystemPrompt({
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

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system,
    messages: parsed.data.messages,
  });

  const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  return NextResponse.json({ content: text, remaining: rate.remaining });
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

function createFallbackReply(method: z.infer<typeof bodySchema>["method"], messageCount: number, language: z.infer<typeof bodySchema>["language"]) {
  if (messageCount >= 7) {
    const completed = {
      nl: `ROOT CAUSE ANALYSIS COMPLETE
{
  "directCauses": ["De slangkoppeling was niet volledig vergrendeld", "De operator stond binnen de spat- of blootstellingszone"],
  "underlyingCauses": ["De controle voor gebruik vereiste geen trekproef op de koppeling", "De werkinstructie voor transfer beschreef de verificatie van tijdelijke slangen onvoldoende"],
  "rootCauses": ["De onderhoudscriteria voor vervanging van transferkoppelingen waren onvolledig", "Leidinggevende verificatie van tijdelijke chemische transfers was inconsistent"],
  "contributingFactors": ["Tijdsdruk bij batchstart", "Gelaatsscherm was beschikbaar maar niet gedragen bij de eerste aansluiting"]
}`,
      en: `ROOT CAUSE ANALYSIS COMPLETE
{
  "directCauses": ["Hose coupling was not fully locked", "Operator was positioned inside the splash zone"],
  "underlyingCauses": ["The pre-use inspection did not require a coupling tug test", "The transfer SOP did not define temporary hose verification"],
  "rootCauses": ["Maintenance replacement criteria for transfer hose couplings were incomplete", "Supervisory verification of temporary chemical transfer setups was inconsistent"],
  "contributingFactors": ["Batch start time pressure", "Face shield was available but not worn during initial connection"]
}`,
      fr: `ROOT CAUSE ANALYSIS COMPLETE
{
  "directCauses": ["Le raccord du flexible n'etait pas completement verrouille", "L'operateur se trouvait dans la zone d'eclaboussure"],
  "underlyingCauses": ["Le controle avant utilisation n'imposait pas de test de traction du raccord", "La procedure de transfert ne definissait pas assez la verification des flexibles temporaires"],
  "rootCauses": ["Les criteres de remplacement des raccords de transfert etaient incomplets", "La verification par la supervision des montages temporaires de transfert chimique etait inconstante"],
  "contributingFactors": ["Pression temporelle au demarrage du lot", "L'ecran facial etait disponible mais non porte lors du raccordement initial"]
}`,
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
        "Pourquoi le raccord s'est-il desserre pendant le transfert ?",
        "Pourquoi l'etape de verification attendue n'a-t-elle pas ete realisee ?",
        "Pourquoi la procedure ne contenait-elle pas cette etape de verification ?",
      ],
      fishbone: [
        "Pour la branche Methode, quelle procedure aurait du prevenir ce rejet ?",
        "Pour la branche Equipement, quel etait l'etat du flexible et des ergots de verrouillage ?",
        "A quelle frequence les montages temporaires de transfert sont-ils verifies par la supervision ?",
      ],
      fmea: [
        "Quelle fonction a echoue en premier : confinement, integrite du raccord, inspection ou positionnement de l'operateur ?",
        "Quels scores de gravite, occurrence et detection attribueriez-vous au desserrage du raccord ?",
        "Quelle mesure de maitrise reduirait le plus le RPN ?",
      ],
      pareto: [
        "Dans les evenements similaires, quelle categorie de cause revient le plus souvent ?",
        "Combien d'incidents de transfert comparables impliquaient des lacunes de procedure ?",
        "Quelle categorie de cause faut-il traiter en premier pour reduire le risque au maximum ?",
      ],
      fault_tree: [
        "Quel evenement sommet devons-nous placer en haut de l'arbre des defaillances ?",
        "Le rejet est-il du a une combinaison ET entre defaillance du raccord et exposition, ou a l'un des deux seuls ?",
        "Quels evenements de base se trouvent sous la branche defaillance du raccord ?",
      ],
      scatter: [
        "Quelles deux variables devons-nous comparer pour rechercher une correlation ?",
        "Les heures d'exposition, le nombre de transferts ou les inspections en retard expliquent-ils le mieux le schema ?",
        "Quels points de donnees doivent etre exclus comme valeurs aberrantes ?",
      ],
    },
  };

  const index = Math.min(Math.floor(messageCount / 2), prompts[language][method].length - 1);
  return prompts[language][method][index];
}
