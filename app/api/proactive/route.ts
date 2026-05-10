import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoProactiveReport, updateDemoProactiveReport } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant, requireTenantCompanyId } from "@/lib/supabase/tenant";
import type { ProactiveReport } from "@/lib/types";

const createSchema = z.object({
  departmentId: z.string().min(1),
  reportType: z.enum(["near_miss", "unsafe_condition", "unsafe_act", "positive_observation"]),
  description: z.string().min(10),
  location: z.string().min(1),
  photoUrl: z.string().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  anonymous: z.boolean(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["open", "in_progress", "closed"]),
  assignedTo: z.string().optional(),
  actionTaken: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid proactive report payload" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const report: ProactiveReport = {
    id: crypto.randomUUID(),
    companyId: tenant.company.id,
    departmentId: parsed.data.departmentId,
    reporterId: parsed.data.anonymous ? null : tenant.user.id,
    reportType: parsed.data.reportType,
    description: parsed.data.description,
    location: parsed.data.location,
    photoUrl: parsed.data.photoUrl ?? null,
    riskLevel: parsed.data.riskLevel,
    status: "open",
    anonymous: parsed.data.anonymous,
    createdAt: new Date().toISOString(),
    assignedTo: null,
    actionTaken: null,
  };

  if (!isSupabaseConfigured()) {
    addDemoProactiveReport(report);
    return NextResponse.json({ report, notificationQueued: report.riskLevel === "high" || report.riskLevel === "critical", demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proactive_reports")
    .insert({
      company_id: report.companyId,
      department_id: report.departmentId,
      reporter_id: report.reporterId,
      report_type: report.reportType,
      description: report.description,
      location: report.location,
      photo_url: report.photoUrl,
      risk_level: report.riskLevel,
      status: report.status,
      anonymous: report.anonymous,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Proactive report insert failed" }, { status: 500 });
  }

  return NextResponse.json({ report: { ...report, id: data.id }, notificationQueued: report.riskLevel === "high" || report.riskLevel === "critical", demoMode: false });
}

export async function PATCH(request: Request) {
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid proactive report update payload" }, { status: 400 });
  }

  await requireTenantCompanyId();

  if (!isSupabaseConfigured()) {
    updateDemoProactiveReport(parsed.data.id, parsed.data);
    return NextResponse.json({ id: parsed.data.id, status: parsed.data.status, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("proactive_reports").update({
    status: parsed.data.status,
    assigned_to: parsed.data.assignedTo ?? null,
    action_taken: parsed.data.actionTaken ?? null,
    closed_at: parsed.data.status === "closed" ? new Date().toISOString() : null,
  }).eq("id", parsed.data.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: parsed.data.id, status: parsed.data.status, demoMode: false });
}
