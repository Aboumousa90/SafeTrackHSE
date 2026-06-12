import type Anthropic from "@anthropic-ai/sdk";
import { listDemoIncidents, listDemoMeasures } from "@/lib/demo-store";
import { incidents as seedIncidents, measures as seedMeasures } from "@/lib/seed-data";

/**
 * Tools the RCA facilitator can call during the interview to ground the
 * analysis in the tenant's own incident history and open actions.
 */
export const rcaTools: Anthropic.Tool[] = [
  {
    name: "search_similar_incidents",
    description:
      "Search the company's incident register for similar past incidents. Call this when historical context would strengthen the analysis — for example to check whether the same failure mode, equipment, or department appeared before, or to verify whether this is a repeat incident.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords describing the failure mode, equipment, or situation to search for (for example 'hose coupling transfer').",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "list_open_measures",
    description:
      "List corrective and preventive measures that are still open or in progress. Call this to check whether a measure addressing the same weakness already exists, or whether earlier measures were never completed — a strong signal of a systemic management-system failure.",
    input_schema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export function executeRcaTool(name: string, input: unknown): string {
  if (name === "search_similar_incidents") {
    const query = typeof (input as { query?: unknown })?.query === "string" ? (input as { query: string }).query : "";
    return searchSimilarIncidents(query);
  }
  if (name === "list_open_measures") {
    return listOpenMeasures();
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

function searchSimilarIncidents(query: string): string {
  const allIncidents = [...listDemoIncidents(), ...seedIncidents];
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);

  const scored = allIncidents
    .map((incident) => {
      const haystack = `${incident.title} ${incident.description} ${incident.location}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { incident, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return JSON.stringify({ matches: [], note: "No similar incidents found in the register." });
  }

  return JSON.stringify({
    matches: scored.map(({ incident }) => ({
      referenceNumber: incident.referenceNumber,
      date: incident.incidentDate,
      title: incident.title,
      severity: incident.severityLevel,
      status: incident.status,
      isPse: incident.isPse,
      description: incident.description.slice(0, 300),
    })),
  });
}

function listOpenMeasures(): string {
  const allMeasures = [...listDemoMeasures(), ...seedMeasures];
  const open = allMeasures.filter((measure) => measure.status === "open" || measure.status === "in_progress");
  const today = new Date().toISOString().slice(0, 10);

  return JSON.stringify({
    openMeasures: open.map((measure) => ({
      incidentId: measure.incidentId,
      category: measure.muopoCategory,
      description: measure.description,
      priority: measure.priority,
      status: measure.status,
      dueDate: measure.dueDate,
      overdue: measure.dueDate < today,
    })),
  });
}
