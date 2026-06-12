import { ANALYSIS_MODEL, getAnthropicClient, languageNames } from "@/lib/ai/claude";
import type { HseAnalyticsSnapshot, Locale } from "@/lib/types";

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { insights: string; expiresAt: number }>();

/**
 * Replaces the snapshot's rule-based narrative with Claude-written insights.
 * Returns the snapshot unchanged when no API key is configured or the call
 * fails, so the dashboard always renders.
 */
export async function enrichSnapshotWithAiInsights(
  snapshot: HseAnalyticsSnapshot,
  language: Locale,
): Promise<HseAnalyticsSnapshot> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return snapshot;
  }

  const cacheKey = `${snapshot.id}:${language}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...snapshot, aiInsights: cached.insights };
  }

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: ANALYSIS_MODEL,
      max_tokens: 1500,
      system: `You are a senior HSE analyst writing the monthly insights section of a management dashboard. Write exactly four short paragraphs separated by blank lines, in this order:
1. The most important systemic weakness this month and why, naming the department concerned.
2. Trend commentary: what the monthly trend and proactive/reactive ratio say about reporting culture.
3. Priority focus areas for next month, as concrete actions in order of risk reduction.
4. Positive highlights worth reinforcing with the workforce.

Be specific: reference the actual numbers, departments, and root cause categories from the data. No headings, no bullet points, no markdown — plain prose paragraphs only. Write in ${languageNames[language]} using correct HSE terminology.`,
      messages: [
        {
          role: "user",
          content: `Monthly HSE data for ${snapshot.periodYear}-${String(snapshot.periodMonth).padStart(2, "0")}:

Incidents: ${snapshot.totalIncidents} (by severity: ${JSON.stringify(snapshot.incidentsBySeverity)})
Proactive reports: ${snapshot.totalProactiveReports} | Observation rounds: ${snapshot.observationRoundsCount}
Measure completion rate: ${snapshot.measureCompletionRate}% | Overdue measures: ${snapshot.overdueMeasuresRate}%
Proactive/reactive ratio: ${snapshot.proactiveReactiveRatio}
Open MUOPO measures by category: ${JSON.stringify(snapshot.muopoBreakdown)}

Department risk ranking (highest first):
${snapshot.departmentRiskRanking.map((dept) => `- ${dept.departmentName}: risk score ${dept.riskScore}, ${dept.incidents} incident(s), ${dept.proactiveReports} proactive report(s), ${dept.observationIssues} observation issue(s)`).join("\n")}

Root cause Pareto:
${snapshot.rootCausePareto.map((point) => `- ${point.name}: ${point.count} (cumulative ${point.cumulative}%)`).join("\n")}

12-month trend (incidents / proactive reports):
${snapshot.monthlyTrend.map((point) => `${point.month}: ${point.incidents}/${point.proactiveReports}`).join(", ")}

Write the four insight paragraphs now.`,
        },
      ],
    });

    const insights = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!insights) {
      return snapshot;
    }

    cache.set(cacheKey, { insights, expiresAt: Date.now() + CACHE_TTL_MS });
    return { ...snapshot, aiInsights: insights };
  } catch {
    return snapshot;
  }
}
