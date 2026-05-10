import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { IncidentReportDocument } from "@/lib/pdf/incident-report";
import { analysisFinding, company, incidents, measures, users } from "@/lib/seed-data";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await requireTenantCompanyId();
  const incident = incidents.find((item) => item.id === params.id) ?? incidents[0];
  const incidentMeasures = measures.filter((measure) => measure.incidentId === incident.id);
  const pdfBuffer = await renderToBuffer(
    <IncidentReportDocument
      company={company}
      incident={incident}
      finding={analysisFinding}
      measures={incidentMeasures}
      author={users[0]}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${incident.referenceNumber}.pdf"`,
    },
  });
}
