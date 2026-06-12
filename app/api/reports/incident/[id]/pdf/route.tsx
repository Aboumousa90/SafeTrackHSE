import React from "react";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { generateReportNarrative } from "@/lib/ai/report";
import { IncidentReportDocument } from "@/lib/pdf/incident-report";
import { analysisFinding, company, companyConfig, incidents, measures, users } from "@/lib/seed-data";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";
import type { Locale } from "@/lib/types";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  await requireTenantCompanyId();
  const incident = incidents.find((item) => item.id === params.id) ?? incidents[0];
  const incidentMeasures = measures.filter((measure) => measure.incidentId === incident.id);
  const author = users[0];

  const langParam = new URL(request.url).searchParams.get("lang");
  const language: Locale = langParam === "nl" || langParam === "en" || langParam === "fr" ? langParam : author.language;

  const narrative = await generateReportNarrative({
    incident,
    finding: analysisFinding,
    measures: incidentMeasures,
    language,
  });

  const pdfBuffer = await renderToBuffer(
    <IncidentReportDocument
      company={company}
      companyConfig={companyConfig}
      incident={incident}
      finding={analysisFinding}
      measures={incidentMeasures}
      author={author}
      executiveSummary={narrative.executiveSummary}
      lessonsLearned={narrative.lessonsLearned}
      language={language}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${incident.referenceNumber}.pdf"`,
    },
  });
}
