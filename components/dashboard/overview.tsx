"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import type { Department, Incident, Measure, ProactiveReport } from "@/lib/types";

const severityColors = { S1: "#E74C3C", S2: "#F39C12", S3: "#F4D03F", S4: "#1B4F72", S5: "#95A5A6" };

export function DashboardOverview({
  departments,
  incidents,
  measures,
  proactiveReports,
}: {
  departments: Department[];
  incidents: Incident[];
  measures: Measure[];
  proactiveReports: ProactiveReport[];
}) {
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();
  const severityData = Object.entries(
    incidents.reduce<Record<string, number>>((acc, incident) => {
      acc[incident.severityLevel] = (acc[incident.severityLevel] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const departmentData = departments.map((department) => ({
    name: department.name.replace("Production ", "Prod. "),
    incidents: incidents.filter((incident) => incident.departmentId === department.id).length,
  }));

  const trendData = [
    { month: "Dec", incidents: 4, proactive: 11 },
    { month: "Jan", incidents: 3, proactive: 14 },
    { month: "Feb", incidents: 5, proactive: 18 },
    { month: "Mar", incidents: 2, proactive: 21 },
    { month: "Apr", incidents: 4, proactive: 24 },
    { month: "May", incidents: incidents.length, proactive: proactiveReports.length },
  ];
  const overdue = measures.filter((measure) => new Date(measure.dueDate) < new Date("2026-05-09") && measure.status !== "verified");
  const metrics: { label: string; value: number; icon: LucideIcon }[] = [
    { label: t.dashboard.openIncidents, value: incidents.filter((incident) => incident.status !== "closed").length, icon: AlertTriangle },
    { label: t.dashboard.pseFlagged, value: incidents.filter((incident) => incident.isPse).length, icon: ShieldCheck },
    { label: t.dashboard.openMeasures, value: measures.filter((measure) => measure.status === "open").length, icon: Clock },
    { label: t.dashboard.proactiveReports, value: proactiveReports.length, icon: Activity },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <section className="industrial-grid rounded-lg bg-white p-6 shadow-panel">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <Badge tone="blue">{t.dashboard.badge}</Badge>
            <h1 className="mt-3 font-heading text-3xl font-bold text-slate-950">{t.dashboard.title}</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              {t.dashboard.description}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
                <Icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-2xl font-bold">{value}</p>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.incidentsByStatus}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {["draft", "in_analysis", "measures_defined"].map((status) => (
              <div key={status} className="min-h-56 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold capitalize">{status.replace("_", " ")}</p>
                  <Badge>{incidents.filter((incident) => incident.status === status).length}</Badge>
                </div>
                <div className="space-y-3">
                  {incidents.filter((incident) => incident.status === status).map((incident) => (
                    <div key={incident.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-primary">{incident.referenceNumber}</p>
                        <Badge tone={incident.severityLevel === "S2" ? "amber" : "blue"}>{incident.severityLevel}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold">{incident.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{incident.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.overdueMeasures}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdue.length === 0 ? <p className="text-sm text-slate-500">{t.dashboard.noOverdueMeasures}</p> : null}
            {overdue.map((measure) => (
              <div key={measure.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                <Badge tone="red">{measure.priority}</Badge>
                <p className="mt-2 text-sm font-semibold">{measure.description}</p>
                <p className="mt-1 text-xs text-red-700">{t.dashboard.due} {measure.dueDate}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.severityDistribution}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {mounted ? <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" outerRadius={88} label>
                  {severityData.map((entry) => <Cell key={entry.name} fill={severityColors[entry.name as keyof typeof severityColors]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.incidentsByDepartment}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {mounted ? <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="incidents" fill="#1B4F72" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.monthlyTrend}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {mounted ? <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="incidents" stroke="#E74C3C" strokeWidth={3} />
                <Line type="monotone" dataKey="proactive" stroke="#27AE60" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
