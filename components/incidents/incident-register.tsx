"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import type { Department, Incident } from "@/lib/types";

export function IncidentRegister({ departments, incidents }: { departments: Department[]; incidents: Incident[] }) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold">{t.nav.incidents}</h1>
          <p className="mt-2 text-slate-600">{t.incident.description}</p>
        </div>
        <Link href="/incidents/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-[#143b55]">
          {t.nav.newIncident}
        </Link>
      </div>
      <Card>
        <CardHeader><CardTitle>{t.nav.incidents}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-slate-500">
              <tr>
                <th className="py-3">Reference</th>
                <th>{t.incident.incidentTitle}</th>
                <th>{t.incident.department}</th>
                <th>{t.incident.severityMatrix}</th>
                <th>PSE</th>
                <th>Status</th>
                <th>{t.incident.date}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td className="py-3 font-bold text-primary">{incident.referenceNumber}</td>
                  <td className="font-semibold">{incident.title}</td>
                  <td>{departments.find((department) => department.id === incident.departmentId)?.name}</td>
                  <td><Badge tone={incident.severityLevel === "S2" ? "amber" : "blue"}>{incident.severityLevel}</Badge></td>
                  <td>{incident.isPse ? <Badge tone="red">PSE</Badge> : <Badge>{t.incident.no}</Badge>}</td>
                  <td><Badge>{incident.status.replace("_", " ")}</Badge></td>
                  <td>{incident.incidentDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
