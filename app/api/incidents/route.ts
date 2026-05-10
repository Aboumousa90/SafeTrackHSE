import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";
import { addDemoIncident, listDemoIncidents } from "@/lib/demo-store";
import { notifyIncidentCreated } from "@/lib/notifications/incident";
import type { Incident } from "@/lib/types";
import { generateReferenceNumber } from "@/lib/utils";

const incidentSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(100),
  departmentId: z.string(),
  incidentDate: z.string(),
  incidentTime: z.string(),
  companyPrefix: z.string().min(2).max(6),
  involvedPersonName: z.string().min(1),
  location: z.string().min(1),
  locationDetail: z.string().optional(),
  isVictim: z.boolean(),
  injuryLocation: z.string().optional(),
  severityLevel: z.enum(["S1", "S2", "S3", "S4", "S5"]),
  severityRationale: z.string().min(1),
  isPse: z.boolean(),
  isUndesiredRelease: z.boolean(),
  productName: z.string().optional(),
  casNumber: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.enum(["kg", "L", "m3"]).optional(),
  sdsUrl: z.string().optional(),
  releaseDuration: z.string().optional(),
  containmentStatus: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = incidentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid incident payload" }, { status: 400 });
  }

  const companyId = await requireTenantCompanyId();
  const referenceNumber = await createReferenceNumber(companyId, parsed.data.companyPrefix);

  if (!isSupabaseConfigured()) {
    const id = crypto.randomUUID();
    const demoIncident = buildIncidentFromPayload({
      id,
      companyId,
      referenceNumber,
      reporterId: "u-1",
      payload: parsed.data,
    });
    addDemoIncident(demoIncident);
    const notification = await notifyIncidentCreated(demoIncident);

    return NextResponse.json({
      id,
      companyId,
      referenceNumber,
      status: "draft",
      notificationQueued: notification.queued,
      notification,
      storageReady: false,
    });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: {
      user,
    },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: incident, error: incidentError } = await supabase
    .from("incidents")
    .insert({
      company_id: companyId,
      reference_number: referenceNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      incident_date: parsed.data.incidentDate,
      incident_time: parsed.data.incidentTime,
      department_id: parsed.data.departmentId,
      reporter_id: user.id,
      location: parsed.data.location,
      location_detail: parsed.data.locationDetail ?? null,
      is_victim: parsed.data.isVictim,
      injury_location: parsed.data.isVictim ? parsed.data.injuryLocation ?? null : null,
      severity_level: parsed.data.severityLevel,
      severity_rationale: parsed.data.severityRationale,
      is_pse: parsed.data.isPse,
      is_undesired_release: parsed.data.isUndesiredRelease,
      status: "draft",
    })
    .select("id, reference_number")
    .single<{ id: string; reference_number: string }>();

  if (incidentError || !incident) {
    return NextResponse.json({ error: incidentError?.message ?? "Incident insert failed" }, { status: 500 });
  }

  if (parsed.data.isPse) {
    const { error: pseError } = await supabase.from("incident_pse_data").insert({
      incident_id: incident.id,
      product_name: parsed.data.productName ?? null,
      cas_number: parsed.data.casNumber ?? null,
      quantity: parsed.data.quantity ?? null,
      unit: parsed.data.unit ?? null,
      sds_url: parsed.data.sdsUrl ?? null,
      release_duration: parsed.data.releaseDuration ?? null,
      containment_status: parsed.data.containmentStatus ?? null,
      corporate_classification: "Pending AI suggestion",
      consequence_area: parsed.data.isUndesiredRelease ? "Process safety" : null,
    });

    if (pseError) {
      return NextResponse.json({ error: pseError.message }, { status: 500 });
    }
  }

  const notification = await notifyIncidentCreated(buildIncidentFromPayload({
    id: incident.id,
    companyId,
    referenceNumber: incident.reference_number,
    reporterId: user.id,
    payload: parsed.data,
  }));

  return NextResponse.json({
    id: incident.id,
    companyId,
    referenceNumber: incident.reference_number,
    status: "draft",
    notificationQueued: notification.queued || notification.sent,
    notification,
    storageReady: true,
  });
}

function buildIncidentFromPayload(input: {
  id: string;
  companyId: string;
  referenceNumber: string;
  reporterId: string;
  payload: z.infer<typeof incidentSchema>;
}): Incident {
  return {
    id: input.id,
    companyId: input.companyId,
    referenceNumber: input.referenceNumber,
    title: input.payload.title,
    description: input.payload.description,
    incidentDate: input.payload.incidentDate,
    incidentTime: input.payload.incidentTime,
    departmentId: input.payload.departmentId,
    involvedPersonName: input.payload.involvedPersonName,
    reporterId: input.reporterId,
    location: input.payload.location,
    locationDetail: input.payload.locationDetail ?? "",
    isVictim: input.payload.isVictim,
    injuryLocation: input.payload.isVictim ? input.payload.injuryLocation ?? null : null,
    severityLevel: input.payload.severityLevel,
    severityRationale: input.payload.severityRationale,
    isPse: input.payload.isPse,
    isUndesiredRelease: input.payload.isUndesiredRelease,
    status: "draft",
    createdAt: new Date().toISOString(),
  };
}

async function createReferenceNumber(companyId: string, companyPrefix: string) {
  if (!isSupabaseConfigured()) {
    return generateReferenceNumber(companyPrefix, 45 + listDemoIncidents().length);
  }

  const supabase = createSupabaseServerClient();
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("incident_date", `${year}-01-01`)
    .lte("incident_date", `${year}-12-31`);

  return generateReferenceNumber(companyPrefix, (count ?? 0) + 1);
}
