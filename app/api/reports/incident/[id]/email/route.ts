import { NextResponse } from "next/server";
import { analysisFinding, incidents, measures } from "@/lib/seed-data";
import { incidentNotificationEmail } from "@/lib/email/templates";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireTenantCompanyId();
  const incident = incidents.find((item) => item.id === params.id) ?? incidents[0];
  const topMeasures = measures.filter((measure) => measure.incidentId === incident.id).slice(0, 3);
  const base = incidentNotificationEmail(incident);

  return NextResponse.json({
    subject: `Management update: ${incident.referenceNumber} ${incident.title}`,
    preview: base.text,
    body: {
      summary: incident.description,
      severity: incident.severityLevel,
      pse: incident.isPse,
      rootCauses: analysisFinding.rootCauses,
      topMeasures: topMeasures.map((measure) => ({
        category: measure.muopoCategory,
        description: measure.description,
        dueDate: measure.dueDate,
        status: measure.status,
      })),
    },
    attachments: [`/api/reports/incident/${incident.id}/pdf`],
  });
}
