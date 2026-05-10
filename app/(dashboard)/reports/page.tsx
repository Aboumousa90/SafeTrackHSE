"use client";

import Link from "next/link";
import { Download, ExternalLink, FileText, Mail, Presentation } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { incidents } from "@/lib/seed-data";

export default function ReportsPage() {
  const { t } = useLanguage();
  const incident = incidents[0];
  const reports = [
    {
      title: t.reports.managementPdf,
      icon: FileText,
      body: t.reports.description,
      href: `/api/reports/incident/${incident.id}/pdf`,
      action: t.reports.downloadPdf,
      iconAction: Download,
    },
    {
      title: t.reports.employeeSlides,
      icon: Presentation,
      body: t.reports.description,
      href: `/reports/awareness/${incident.id}`,
      action: t.reports.openSlides,
      iconAction: ExternalLink,
    },
    {
      title: t.reports.managementEmail,
      icon: Mail,
      body: t.reports.description,
      href: `/api/reports/incident/${incident.id}/email`,
      action: t.reports.viewDraft,
      iconAction: ExternalLink,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">{t.reports.title}</h1>
        <p className="mt-2 text-slate-600">{t.reports.description}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.reports.selectedIncident}</CardTitle></CardHeader>
        <CardContent>
          <p className="font-bold text-primary">{incident.referenceNumber}</p>
          <p className="mt-1 font-semibold">{incident.title}</p>
          <p className="mt-2 text-sm text-slate-600">{incident.description}</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        {reports.map((report) => {
          const Icon = report.icon;
          const ActionIcon = report.iconAction;
          return (
            <Card key={report.title}>
              <CardHeader><CardTitle>{report.title}</CardTitle></CardHeader>
              <CardContent>
                <Icon className="h-8 w-8 text-primary" />
                <p className="mt-4 min-h-16 text-sm text-slate-600">{report.body}</p>
                <Link
                  href={report.href}
                  target={report.href.startsWith("/api") ? "_blank" : undefined}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-[#143b55]"
                >
                  <ActionIcon className="h-4 w-4" />
                  {report.action}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <section className="grid gap-4 rounded-lg bg-[#102A3A] p-5 text-white md:grid-cols-4">
        {[t.reports.whatHappened, t.reports.whyHappened, t.reports.whatDoing, t.reports.lessonsLearned].map((title, index) => (
          <div key={title} className="rounded-md border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-bold text-white/50">Slide {index + 1}</p>
            <h2 className="mt-2 font-heading text-xl font-bold">{title}</h2>
          </div>
        ))}
      </section>
    </div>
  );
}
