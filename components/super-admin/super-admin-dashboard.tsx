"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Building2, CheckCircle2, DatabaseZap, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import type { PlatformHealthCheck, PlatformTenantSummary, ReleaseReadinessSummary } from "@/lib/types";

function statusTone(status: PlatformHealthCheck["status"]) {
  if (status === "critical") return "red";
  if (status === "warning") return "amber";
  return "green";
}

export function SuperAdminDashboard({
  tenants,
  healthChecks,
  readiness,
}: {
  tenants: PlatformTenantSummary[];
  healthChecks: PlatformHealthCheck[];
  readiness: ReleaseReadinessSummary;
}) {
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const totals = useMemo(() => ({
    tenants: tenants.length,
    users: tenants.reduce((sum, tenant) => sum + tenant.activeUsers, 0),
    incidents: tenants.reduce((sum, tenant) => sum + tenant.incidentsThisMonth, 0),
    storage: tenants.reduce((sum, tenant) => sum + tenant.storageGb, 0),
  }), [tenants]);
  const metrics: Array<{ label: string; value: string; icon: LucideIcon }> = [
    { label: t.superAdmin.tenants, value: String(totals.tenants), icon: Building2 },
    { label: t.superAdmin.activeUsers, value: String(totals.users), icon: Users },
    { label: t.superAdmin.incidentsThisMonth, value: String(totals.incidents), icon: Activity },
    { label: t.superAdmin.storageUsed, value: `${totals.storage.toFixed(1)} GB`, icon: DatabaseZap },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <Badge tone="blue">{t.superAdmin.badge}</Badge>
        <h1 className="mt-3 font-heading text-3xl font-bold">{t.superAdmin.title}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">{t.superAdmin.description}</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <Icon className="h-5 w-5 text-primary" />
              <p className="mt-4 text-3xl font-bold">{value}</p>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t.superAdmin.productionReadiness}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-emerald-50 p-4">
              <p className="text-2xl font-bold text-emerald-800">{readiness.ready}</p>
              <p className="text-sm font-semibold text-emerald-700">{t.superAdmin.ready}</p>
            </div>
            <div className="rounded-md bg-amber-50 p-4">
              <p className="text-2xl font-bold text-amber-800">{readiness.needsConfig}</p>
              <p className="text-sm font-semibold text-amber-700">{t.superAdmin.needsConfig}</p>
            </div>
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-2xl font-bold text-red-800">{readiness.blocked}</p>
              <p className="text-sm font-semibold text-red-700">{t.superAdmin.blocked}</p>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            {readiness.checks.map((check) => (
              <div key={`${check.area}-${check.name}`} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${check.status === "ready" ? "text-safe" : check.status === "blocked" ? "text-danger" : "text-warning"}`} />
                    <p className="font-semibold">{check.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{check.area}</Badge>
                    <Badge tone={check.status === "ready" ? "green" : check.status === "blocked" ? "red" : "amber"}>{check.status.replace("_", " ")}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{check.detail}</p>
                <p className="mt-1 text-xs font-semibold text-primary">{check.action}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.superAdmin.tenantHealth}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tenants}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="companyName" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="healthScore" radius={[4, 4, 0, 0]}>
                    {tenants.map((tenant) => <Cell key={tenant.companyId} fill={tenant.healthScore >= 85 ? "#27AE60" : tenant.healthScore >= 70 ? "#F39C12" : "#E74C3C"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.superAdmin.operationalHealth}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthChecks.map((check) => (
              <div key={check.name} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{check.name}</p>
                  <Badge tone={statusTone(check.status)}>{check.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{check.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t.superAdmin.tenantManagement}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">{t.superAdmin.tenant}</th>
                <th className="px-3 py-2">{t.superAdmin.plan}</th>
                <th className="px-3 py-2">{t.superAdmin.users}</th>
                <th className="px-3 py-2">{t.superAdmin.incidents}</th>
                <th className="px-3 py-2">{t.superAdmin.highSeverity}</th>
                <th className="px-3 py-2">{t.superAdmin.openMeasures}</th>
                <th className="px-3 py-2">{t.superAdmin.overdue}</th>
                <th className="px-3 py-2">{t.superAdmin.proactive}</th>
                <th className="px-3 py-2">{t.superAdmin.rls}</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.companyId} className="border-t border-slate-200">
                  <td className="px-3 py-3">
                    <p className="font-semibold">{tenant.companyName}</p>
                    <p className="text-xs text-slate-500">{tenant.industry} / {tenant.country}</p>
                  </td>
                  <td className="px-3 py-3"><Badge tone={tenant.subscriptionPlan === "Enterprise" ? "blue" : "neutral"}>{tenant.subscriptionPlan}</Badge></td>
                  <td className="px-3 py-3">{tenant.activeUsers}</td>
                  <td className="px-3 py-3">{tenant.incidentsThisMonth}</td>
                  <td className="px-3 py-3"><Badge tone={tenant.highSeverityIncidents > 0 ? "amber" : "green"}>{tenant.highSeverityIncidents}</Badge></td>
                  <td className="px-3 py-3">{tenant.openMeasures}</td>
                  <td className="px-3 py-3"><Badge tone={tenant.overdueMeasures > 0 ? "red" : "green"}>{tenant.overdueMeasures}</Badge></td>
                  <td className="px-3 py-3">{tenant.proactiveReports}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className={`h-4 w-4 ${tenant.rlsStatus === "enforced" ? "text-safe" : "text-warning"}`} />
                      <Badge tone={tenant.rlsStatus === "enforced" ? "green" : "amber"}>{tenant.rlsStatus.replace("_", " ")}</Badge>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
