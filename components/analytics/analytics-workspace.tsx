"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, ClipboardCheck, Download, LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import type { HseAnalyticsSnapshot, MuopoCategory, SeverityLevel } from "@/lib/types";

const severityColors: Record<SeverityLevel, string> = {
  S1: "#E74C3C",
  S2: "#F39C12",
  S3: "#F4D03F",
  S4: "#1B4F72",
  S5: "#95A5A6",
};

const muopoLabels: Record<MuopoCategory, string> = {
  M: "People",
  U: "Equipment",
  O: "Environment",
  P: "Procedures",
  O2: "Organisation",
};

function heatColor(value: number) {
  if (value >= 3) return "#E74C3C";
  if (value === 2) return "#F39C12";
  if (value === 1) return "#1B4F72";
  return "#27AE60";
}

export function AnalyticsWorkspace({ snapshot }: { snapshot: HseAnalyticsSnapshot }) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const severityData = useMemo(() => Object.entries(snapshot.incidentsBySeverity).map(([name, value]) => ({ name, value })), [snapshot.incidentsBySeverity]);
  const muopoData = useMemo(() => Object.entries(snapshot.muopoBreakdown).map(([name, value]) => ({ name: name as MuopoCategory, value })), [snapshot.muopoBreakdown]);
  const narrative = snapshot.aiInsights.split("\n\n");
  const periodLabel = `${snapshot.periodYear}-${String(snapshot.periodMonth).padStart(2, "0")}`;
  const metrics: Array<{ label: string; value: string; icon: LucideIcon; tone?: "red" | "amber" | "green" | "blue" }> = [
    { label: t.analytics.incidents, value: String(snapshot.totalIncidents), icon: AlertTriangle, tone: snapshot.totalIncidents > 0 ? "amber" : "green" },
    { label: t.analytics.proactiveReports, value: String(snapshot.totalProactiveReports), icon: TrendingUp, tone: "green" },
    { label: t.analytics.observationRounds, value: String(snapshot.observationRoundsCount), icon: ClipboardCheck, tone: "blue" },
    { label: t.analytics.measuresOnTrack, value: `${snapshot.measureCompletionRate}%`, icon: BarChart3, tone: snapshot.measureCompletionRate >= 75 ? "green" : "amber" },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="blue">{t.analytics.badge} - {periodLabel}</Badge>
          <h1 className="mt-3 font-heading text-3xl font-bold">{t.analytics.title}</h1>
          <p className="mt-2 max-w-3xl text-slate-600">{t.analytics.description}</p>
        </div>
        <a
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          href={`/api/analytics/monthly?year=${snapshot.periodYear}&month=${snapshot.periodMonth}&format=csv`}
        >
          <Download className="h-4 w-4" /> {t.analytics.exportCsv}
        </a>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-5 w-5 text-primary" />
                <Badge tone={tone}>{periodLabel}</Badge>
              </div>
              <p className="mt-4 text-3xl font-bold">{value}</p>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.trend}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshot.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="incidents" stroke="#E74C3C" strokeWidth={3} />
                  <Line type="monotone" dataKey="proactiveReports" stroke="#27AE60" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.narrative}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            {narrative.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.departmentRisk}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.departmentRiskRanking}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="departmentName" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="riskScore" radius={[4, 4, 0, 0]}>
                    {snapshot.departmentRiskRanking.map((entry) => <Cell key={entry.departmentId} fill={entry.riskScore >= 70 ? "#E74C3C" : entry.riskScore >= 40 ? "#F39C12" : "#1B4F72"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.rootCausePareto}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={snapshot.rootCausePareto}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="count" fill="#1B4F72" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#E74C3C" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.muopoHeatmap}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {muopoData.map((item) => (
                <div key={item.name} className="flex aspect-square flex-col items-center justify-center rounded-md text-white" style={{ backgroundColor: heatColor(item.value) }}>
                  <span className="font-heading text-2xl font-bold">{item.name}</span>
                  <span className="text-xs font-semibold">{item.value} open</span>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-500 sm:grid-cols-2">
              {muopoData.map((item) => <p key={item.name}>{item.name}: {muopoLabels[item.name]}</p>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.analytics.proactiveReactiveRatio}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
            <div className="flex aspect-square items-center justify-center rounded-full border-[18px] border-safe bg-slate-50">
              <div className="text-center">
                <LineChartIcon className="mx-auto h-6 w-6 text-safe" />
                <p className="mt-2 font-heading text-4xl font-bold">{snapshot.proactiveReactiveRatio}</p>
                <p className="text-xs font-semibold text-slate-500">reports / incident</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <p><strong className="text-slate-900">{t.analytics.completion}:</strong> {snapshot.measureCompletionRate}%</p>
              <p><strong className="text-slate-900">{t.analytics.overdueExposure}:</strong> {snapshot.overdueMeasuresRate}%</p>
              <p><strong className="text-slate-900">{t.analytics.severityMix}:</strong> {severityData.map((item) => `${item.name} ${item.value}`).join(", ")}.</p>
              <div className="flex flex-wrap gap-2">
                {severityData.map((item) => <Badge key={item.name} style={{ backgroundColor: severityColors[item.name as SeverityLevel], color: "white" }}>{item.name}: {item.value}</Badge>)}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
