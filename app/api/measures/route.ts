import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoMeasure, attachDemoMeasureEvidence, updateDemoMeasureStatus } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";
import type { Measure } from "@/lib/types";

const createSchema = z.object({
  id: z.string().min(1),
  incidentId: z.string().min(1),
  muopoCategory: z.enum(["M", "U", "O", "P", "O2"]),
  description: z.string().min(5),
  priority: z.enum(["immediate", "short_term", "long_term"]),
  responsiblePersonId: z.string().min(1),
  dueDate: z.string().min(1),
});

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "in_progress", "completed", "verified"]).optional(),
  evidenceUrl: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid measure payload" }, { status: 400 });
  }

  const companyId = await requireTenantCompanyId();
  const measure: Measure = {
    id: parsed.data.id,
    incidentId: parsed.data.incidentId,
    muopoCategory: parsed.data.muopoCategory,
    description: parsed.data.description,
    responsiblePersonId: parsed.data.responsiblePersonId,
    dueDate: parsed.data.dueDate,
    priority: parsed.data.priority,
    status: "open",
  };

  if (!isSupabaseConfigured()) {
    addDemoMeasure(measure);
    return NextResponse.json({ measure, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("incident_measures")
    .insert({
      incident_id: measure.incidentId,
      company_id: companyId,
      muopo_category: measure.muopoCategory,
      description: measure.description,
      responsible_person_id: measure.responsiblePersonId,
      due_date: measure.dueDate,
      priority: measure.priority,
      status: measure.status,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Measure insert failed" }, { status: 500 });
  }

  return NextResponse.json({ measure: { ...measure, id: data.id }, demoMode: false });
}

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid measure status payload" }, { status: 400 });
  }

  if (!parsed.data.status && !parsed.data.evidenceUrl) {
    return NextResponse.json({ error: "No measure update supplied" }, { status: 400 });
  }

  await requireTenantCompanyId();

  if (!isSupabaseConfigured()) {
    if (parsed.data.status) updateDemoMeasureStatus(parsed.data.id, parsed.data.status);
    if (parsed.data.evidenceUrl) attachDemoMeasureEvidence(parsed.data.id, parsed.data.evidenceUrl);
    return NextResponse.json({ id: parsed.data.id, status: parsed.data.status, evidenceUrl: parsed.data.evidenceUrl, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const updatePayload: Record<string, string> = {};
  if (parsed.data.status) updatePayload.status = parsed.data.status;
  if (parsed.data.evidenceUrl) updatePayload.evidence_url = parsed.data.evidenceUrl;
  if (parsed.data.status === "completed") updatePayload.completed_at = new Date().toISOString();
  if (parsed.data.status === "verified") updatePayload.verified_at = new Date().toISOString();

  const { error } = await supabase.from("incident_measures").update(updatePayload).eq("id", parsed.data.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: parsed.data.id, status: parsed.data.status, evidenceUrl: parsed.data.evidenceUrl, demoMode: false });
}
