import { NextResponse } from "next/server";
import { z } from "zod";
import { saveDemoAnalysis } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

const findingSchema = z.object({
  directCauses: z.array(z.string()),
  underlyingCauses: z.array(z.string()),
  rootCauses: z.array(z.string()),
  contributingFactors: z.array(z.string()),
});

const bodySchema = z.object({
  incidentId: z.string().min(1),
  method: z.enum(["5why", "fishbone", "fmea", "pareto", "fault_tree", "scatter"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  finding: findingSchema,
  analysisData: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid analysis payload" }, { status: 400 });
  }

  await requireTenantCompanyId();
  const analysisId = crypto.randomUUID();

  if (!isSupabaseConfigured()) {
    saveDemoAnalysis({
      id: analysisId,
      incidentId: parsed.data.incidentId,
      method: parsed.data.method,
      finding: parsed.data.finding,
      messages: parsed.data.messages,
      completedAt: new Date().toISOString(),
    });
    return NextResponse.json({ id: analysisId, saved: true, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("incident_analyses")
    .insert({
      incident_id: parsed.data.incidentId,
      method: parsed.data.method,
      ai_conversation: parsed.data.messages,
      direct_causes: parsed.data.finding.directCauses,
      underlying_causes: parsed.data.finding.underlyingCauses,
      root_causes: parsed.data.finding.rootCauses,
      contributing_factors: parsed.data.finding.contributingFactors,
      analysis_data: parsed.data.analysisData,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Analysis insert failed" }, { status: 500 });
  }

  await supabase.from("incidents").update({ status: "measures_defined", updated_at: new Date().toISOString() }).eq("id", parsed.data.incidentId);

  return NextResponse.json({ id: data.id, saved: true, demoMode: false });
}
