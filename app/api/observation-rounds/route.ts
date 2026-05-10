import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoObservationRound, addDemoProactiveReport } from "@/lib/demo-store";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import type { ObservationRound, ProactiveReport } from "@/lib/types";

const observationSchema = z.object({
  category: z.string().min(1),
  status: z.enum(["ok", "not_ok", "na"]),
  comment: z.string().max(500),
  photoUrl: z.string().nullable().optional(),
});

const createSchema = z.object({
  departmentId: z.string().min(1),
  roundDate: z.string().min(1),
  roundTime: z.string().min(1),
  location: z.string().min(1),
  observations: z.array(observationSchema).min(1),
  overallScore: z.number().int().min(1).max(5),
  followUpRequired: z.boolean(),
  notes: z.string().max(2000),
});

function createFollowUpReports(round: ObservationRound) {
  return round.observations
    .filter((observation) => observation.status === "not_ok")
    .map<ProactiveReport>((observation) => ({
      id: crypto.randomUUID(),
      companyId: round.companyId,
      departmentId: round.departmentId,
      reporterId: round.observerId,
      reportType: "unsafe_condition",
      description: `Observation round follow-up: ${observation.category}. ${observation.comment || "Corrective action required."}`,
      location: round.location,
      photoUrl: observation.photoUrl ?? null,
      riskLevel: round.overallScore <= 2 ? "high" : "medium",
      status: "open",
      anonymous: false,
      createdAt: new Date().toISOString(),
      assignedTo: null,
      actionTaken: null,
    }));
}

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid observation round payload" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();
  const round: ObservationRound = {
    id: crypto.randomUUID(),
    companyId: tenant.company.id,
    observerId: tenant.user.id,
    departmentId: parsed.data.departmentId,
    roundDate: parsed.data.roundDate,
    roundTime: parsed.data.roundTime,
    location: parsed.data.location,
    observations: parsed.data.observations,
    overallScore: parsed.data.overallScore,
    followUpRequired: parsed.data.followUpRequired || parsed.data.observations.some((observation) => observation.status === "not_ok"),
    notes: parsed.data.notes,
    createdAt: new Date().toISOString(),
  };
  const followUps = round.followUpRequired ? createFollowUpReports(round) : [];

  if (!isSupabaseConfigured()) {
    addDemoObservationRound(round);
    followUps.forEach(addDemoProactiveReport);
    return NextResponse.json({ round, followUpsCreated: followUps.length, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("observation_rounds")
    .insert({
      company_id: round.companyId,
      observer_id: round.observerId,
      department_id: round.departmentId,
      round_date: round.roundDate,
      round_time: round.roundTime,
      location: round.location,
      observations: round.observations,
      overall_score: round.overallScore,
      follow_up_required: round.followUpRequired,
      notes: round.notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Observation round insert failed" }, { status: 500 });
  }

  if (followUps.length > 0) {
    const { error: followUpError } = await supabase.from("proactive_reports").insert(
      followUps.map((report) => ({
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
      })),
    );

    if (followUpError) {
      return NextResponse.json({ error: followUpError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ round: { ...round, id: data.id }, followUpsCreated: followUps.length, demoMode: false });
}
