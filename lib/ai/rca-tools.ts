import type Anthropic from "@anthropic-ai/sdk";
import { listDemoIncidents, listDemoMeasures } from "@/lib/demo-store";
import { incidents as seedIncidents, measures as seedMeasures } from "@/lib/seed-data";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

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

interface IncidentMatchSource {
  referenceNumber: string;
  date: string;
  title: string;
  severity: string;
  status: string;
  isPse: boolean;
  haystack: string;
  description: string;
}

interface OpenMeasureSource {
  incidentId: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
}

export async function executeRcaTool(name: string, input: unknown): Promise<string> {
  if (name === "search_similar_incidents") {
    const query = typeof (input as { query?: unknown })?.query === "string" ? (input as { query: string }).query : "";
    return searchSimilarIncidents(query);
  }
  if (name === "list_open_measures") {
    return listOpenMeasures();
  }
  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

async function loadIncidentSources(): Promise<IncidentMatchSource[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("incidents")
        .select("reference_number, incident_date, title, description, location, severity_level, status, is_pse")
        .order("incident_date", { ascending: false })
        .limit(200);

      if (!error && data) {
        return data.map((row) => ({
          referenceNumber: row.reference_number,
          date: row.incident_date,
          title: row.title,
          severity: row.severity_level,
          status: row.status,
          isPse: Boolean(row.is_pse),
          haystack: `${row.title} ${row.description} ${row.location ?? ""}`.toLowerCase(),
          description: row.description,
        }));
      }
    } catch {
      // Fall through to demo data below.
    }
  }

  return [...listDemoIncidents(), ...seedIncidents].map((incident) => ({
    referenceNumber: incident.referenceNumber,
    date: incident.incidentDate,
    title: incident.title,
    severity: incident.severityLevel,
    status: incident.status,
    isPse: incident.isPse,
    haystack: `${incident.title} ${incident.description} ${incident.location}`.toLowerCase(),
    description: incident.description,
  }));
}

async function loadOpenMeasureSources(): Promise<OpenMeasureSource[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase
        .from("incident_measures")
        .select("incident_id, muopo_category, description, priority, status, due_date")
        .in("status", ["open", "in_progress"])
        .order("due_date", { ascending: true })
        .limit(100);

      if (!error && data) {
        return data.map((row) => ({
          incidentId: row.incident_id,
          category: row.muopo_category,
          description: row.description,
          priority: row.priority,
          status: row.status,
          dueDate: row.due_date,
        }));
      }
    } catch {
      // Fall through to demo data below.
    }
  }

  return [...listDemoMeasures(), ...seedMeasures]
    .filter((measure) => measure.status === "open" || measure.status === "in_progress")
    .map((measure) => ({
      incidentId: measure.incidentId,
      category: measure.muopoCategory,
      description: measure.description,
      priority: measure.priority,
      status: measure.status,
      dueDate: measure.dueDate,
    }));
}

async function searchSimilarIncidents(query: string): Promise<string> {
  const sources = await loadIncidentSources();
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);

  const scored = sources
    .map((incident) => ({
      incident,
      score: terms.reduce((sum, term) => sum + (incident.haystack.includes(term) ? 1 : 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return JSON.stringify({ matches: [], note: "No similar incidents found in the register." });
  }

  return JSON.stringify({
    matches: scored.map(({ incident }) => ({
      referenceNumber: incident.referenceNumber,
      date: incident.date,
      title: incident.title,
      severity: incident.severity,
      status: incident.status,
      isPse: incident.isPse,
      description: incident.description.slice(0, 300),
    })),
  });
}

async function listOpenMeasures(): Promise<string> {
  const open = await loadOpenMeasureSources();
  const today = new Date().toISOString().slice(0, 10);

  return JSON.stringify({
    openMeasures: open.map((measure) => ({
      ...measure,
      overdue: measure.dueDate < today,
    })),
  });
}
