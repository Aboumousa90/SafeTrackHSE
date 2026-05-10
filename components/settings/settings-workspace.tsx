"use client";

import { useMemo, useState } from "react";
import { Building2, CreditCard, FileJson, Plus, ShieldAlert, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { Company, CompanyConfig, CorporatePseRule, Department, NotificationSettings, SeverityCell, SeverityLevel, TenantUser, UserRole } from "@/lib/types";

const roles: UserRole[] = ["company_admin", "hse_manager", "supervisor", "employee"];
const notificationKeys: Array<keyof NotificationSettings> = ["newIncident", "escalatedSeverity", "overdueMeasure", "monthlyAnalytics", "proactiveHighRisk"];

const severityTone: Record<SeverityLevel, string> = {
  S1: "bg-red-600",
  S2: "bg-orange-500",
  S3: "bg-yellow-400 text-slate-950",
  S4: "bg-blue-700",
  S5: "bg-slate-500",
};

export function SettingsWorkspace({
  initialCompany,
  initialDepartments,
  initialUsers,
  initialConfig,
  usage,
}: {
  initialCompany: Company;
  initialDepartments: Department[];
  initialUsers: TenantUser[];
  initialConfig: CompanyConfig;
  usage: { incidentsThisMonth: number; activeUsers: number; storageGb: number };
}) {
  const { locale, t } = useLanguage();
  const [company, setCompany] = useState(initialCompany);
  const [departments, setDepartments] = useState(initialDepartments);
  const [users, setUsers] = useState(initialUsers);
  const [config, setConfig] = useState(initialConfig);
  const [status, setStatus] = useState(t.settings.ready);
  const [departmentName, setDepartmentName] = useState("");
  const [departmentManagerId, setDepartmentManagerId] = useState(initialUsers[0]?.id ?? "");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("employee");
  const [inviteDepartmentId, setInviteDepartmentId] = useState(initialDepartments[0]?.id ?? "");
  const [inviteLanguage, setInviteLanguage] = useState<TenantUser["language"]>("nl");
  const [pseJson, setPseJson] = useState(JSON.stringify(initialConfig.corporatePseStandard, null, 2));
  const notificationLabels: Record<keyof NotificationSettings, string> = {
    newIncident: t.nav.newIncident,
    escalatedSeverity: locale === "nl" ? "S1/S2-escalatie" : locale === "fr" ? "Escalade S1/S2" : "S1/S2 escalation",
    overdueMeasure: t.measures.overdue,
    monthlyAnalytics: t.analytics.title,
    proactiveHighRisk: t.proactive.highRiskQueued,
  };

  const severityCounts = useMemo(() => {
    return config.severityMatrix.reduce<Record<SeverityLevel, number>>((acc, cell) => {
      acc[cell.level] = (acc[cell.level] ?? 0) + 1;
      return acc;
    }, { S1: 0, S2: 0, S3: 0, S4: 0, S5: 0 });
  }, [config.severityMatrix]);

  async function patchSettings<T>(payload: Record<string, unknown>, onSuccess: (result: T) => void, successMessage: string) {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      setStatus(result.error ?? "Settings update failed.");
      return;
    }
    onSuccess(result);
    setStatus(successMessage);
  }

  function updateSeverityCell(cell: SeverityCell, level: SeverityLevel) {
    setConfig((current) => ({
      ...current,
      severityMatrix: current.severityMatrix.map((item) => item.likelihood === cell.likelihood && item.consequence === cell.consequence ? { ...item, level } : item),
    }));
  }

  function toggleNotification(key: keyof NotificationSettings, role: UserRole) {
    setConfig((current) => {
      const enabled = current.notificationSettings[key].includes(role);
      return {
        ...current,
        notificationSettings: {
          ...current.notificationSettings,
          [key]: enabled ? current.notificationSettings[key].filter((item) => item !== role) : [...current.notificationSettings[key], role],
        },
      };
    });
  }

  async function saveProfile() {
    await patchSettings<{ company: Company }>(
      { action: "profile", name: company.name, industry: company.industry, country: company.country, subscriptionPlan: company.subscriptionPlan, logoUrl: company.logoUrl },
      (result) => setCompany(result.company),
      "Company profile saved.",
    );
  }

  async function addDepartment() {
    await patchSettings<{ department: Department }>(
      { action: "department", name: departmentName, managerId: departmentManagerId },
      (result) => {
        setDepartments((current) => [result.department, ...current]);
        setDepartmentName("");
      },
      "Department added.",
    );
  }

  async function inviteUser() {
    await patchSettings<{ user: TenantUser }>(
      { action: "user", fullName: inviteName, email: inviteEmail, role: inviteRole, departmentId: inviteDepartmentId, language: inviteLanguage },
      (result) => {
        setUsers((current) => [result.user, ...current]);
        setInviteName("");
        setInviteEmail("");
      },
      "User invite staged.",
    );
  }

  async function saveConfig() {
    let corporatePseStandard: CorporatePseRule[];
    try {
      const parsed = JSON.parse(pseJson) as CorporatePseRule[];
      if (!Array.isArray(parsed)) throw new Error("PSE standard must be an array.");
      corporatePseStandard = parsed;
    } catch {
      setStatus("Corporate PSE standard must be valid JSON array data.");
      return;
    }

    const nextConfig = { ...config, corporatePseStandard };
    await patchSettings<{ config: CompanyConfig }>(
      { action: "config", ...nextConfig },
      (result) => {
        setConfig(result.config);
        setPseJson(JSON.stringify(result.config.corporatePseStandard, null, 2));
      },
      "Company configuration saved.",
    );
  }

  async function uploadTemplate(file: File | undefined, type: "report" | "slide") {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("incidentId", "company-config");
    body.append("category", type === "report" ? "reports" : "slides");
    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as { path?: string; error?: string; demoMode?: boolean };
    if (!response.ok || !result.path) {
      setStatus(result.error ?? "Template upload failed.");
      return;
    }
    setConfig((current) => type === "report" ? { ...current, reportTemplateUrl: result.path ?? null } : { ...current, slideTemplateUrl: result.path ?? null });
    setStatus(result.demoMode ? "Template validated in demo mode." : "Template uploaded.");
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("incidentId", "company-config");
    body.append("category", "logos");
    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as { path?: string; error?: string; demoMode?: boolean };
    if (!response.ok || !result.path) {
      setStatus(result.error ?? "Logo upload failed.");
      return;
    }
    setCompany((current) => ({ ...current, logoUrl: result.path ?? "" }));
    setStatus(result.demoMode ? "Logo validated in demo mode." : "Logo uploaded.");
  }

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div>
        <h1 className="font-heading text-3xl font-bold">{t.settings.title}</h1>
        <p className="mt-2 text-slate-600">{t.settings.description}</p>
        <p className="mt-2 text-sm font-semibold text-primary">{status}</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader><CardTitle><Building2 className="mr-2 inline h-5 w-5" />{t.settings.companyProfile}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input value={company.name} onChange={(event) => setCompany({ ...company, name: event.target.value })} placeholder={t.settings.companyName} />
              <Input value={company.industry} onChange={(event) => setCompany({ ...company, industry: event.target.value })} placeholder={t.settings.industry} />
              <Input value={company.country} onChange={(event) => setCompany({ ...company, country: event.target.value })} placeholder={t.settings.country} />
              <Select value={company.subscriptionPlan} onChange={(event) => setCompany({ ...company, subscriptionPlan: event.target.value as Company["subscriptionPlan"] })}>
                <option>Basic</option>
                <option>Professional</option>
                <option>Enterprise</option>
              </Select>
            </div>
            <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-sm font-semibold">
              <Upload className="h-4 w-4" /> {company.logoUrl ? t.settings.logoAttached : t.settings.uploadLogo}
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(event.target.files?.[0])} />
            </label>
            <Button onClick={() => void saveProfile()}>{t.settings.saveProfile}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><Users className="mr-2 inline h-5 w-5" />{t.settings.usersDepartments}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-[1fr_180px_120px]">
              <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder={t.settings.newDepartment} />
              <Select value={departmentManagerId} onChange={(event) => setDepartmentManagerId(event.target.value)}>
                {users.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
              </Select>
              <Button disabled={!departmentName} onClick={() => void addDepartment()}><Plus className="h-4 w-4" /> {t.settings.add}</Button>
            </div>
            <div className="flex flex-wrap gap-2">{departments.map((department) => <Badge key={department.id} tone="blue">{department.name}</Badge>)}</div>
            <div className="grid gap-2 rounded-md bg-slate-50 p-3 md:grid-cols-2">
              <Input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder={t.settings.fullName} />
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={t.settings.email} type="email" />
              <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as UserRole)}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
              <Select value={inviteDepartmentId} onChange={(event) => setInviteDepartmentId(event.target.value)}>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
              <Select value={inviteLanguage} onChange={(event) => setInviteLanguage(event.target.value as TenantUser["language"])}>
                <option value="nl">NL</option>
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </Select>
              <Button disabled={!inviteName || !inviteEmail} onClick={() => void inviteUser()}><Plus className="h-4 w-4" /> {t.settings.inviteUser}</Button>
            </div>
            <div className="space-y-2">
              {users.map((user) => <div key={user.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3"><span className="font-semibold">{user.fullName}</span><Badge>{user.role}</Badge></div>)}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle><ShieldAlert className="mr-2 inline h-5 w-5" />{t.settings.severityBuilder}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {config.severityMatrix.map((cell) => (
                <button key={`${cell.likelihood}-${cell.consequence}`} className={`min-h-16 rounded-md p-2 text-xs font-bold text-white ${severityTone[cell.level]}`} onClick={() => updateSeverityCell(cell, cell.level === "S1" ? "S5" : cell.level === "S2" ? "S1" : cell.level === "S3" ? "S2" : cell.level === "S4" ? "S3" : "S4")}>
                  L{cell.likelihood} C{cell.consequence}<br />{cell.level}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(severityCounts).map(([level, count]) => <Badge key={level}>{level}: {count}</Badge>)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle><FileJson className="mr-2 inline h-5 w-5" />{t.settings.pseStandard}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea className="min-h-64 font-mono text-xs" value={pseJson} onChange={(event) => setPseJson(event.target.value)} />
            <p className="text-xs font-semibold text-slate-500">JSON array with productClass, thresholdQuantity, unit, classification, and consequenceArea.</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.settings.notificationPreferences}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {notificationKeys.map((key) => (
              <div key={key} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold">{notificationLabels[key]}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <button key={role} onClick={() => toggleNotification(key, role)} className={`rounded-md border px-2 py-1 text-xs font-semibold ${config.notificationSettings[key].includes(role) ? "border-primary bg-blue-50 text-primary" : "border-slate-200 text-slate-500"}`}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.settings.reportTemplates}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input value={config.brandColor} onChange={(event) => setConfig({ ...config, brandColor: event.target.value })} placeholder="#1B4F72" />
            <Textarea value={config.footerText} onChange={(event) => setConfig({ ...config, footerText: event.target.value })} placeholder={t.settings.reportFooter} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-sm font-semibold">
                <Upload className="h-4 w-4" /> {config.reportTemplateUrl ? t.settings.reportTemplates : t.settings.uploadReportTemplate}
                <input className="sr-only" type="file" accept=".pdf,.docx,.xlsx" onChange={(event) => void uploadTemplate(event.target.files?.[0], "report")} />
              </label>
              <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 text-sm font-semibold">
                <Upload className="h-4 w-4" /> {config.slideTemplateUrl ? t.settings.reportTemplates : t.settings.uploadSlideTemplate}
                <input className="sr-only" type="file" accept=".pdf,.pptx,.png,.jpg,.jpeg" onChange={(event) => void uploadTemplate(event.target.files?.[0], "slide")} />
              </label>
            </div>
            <Button onClick={() => void saveConfig()}>{t.settings.saveConfig}</Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle><CreditCard className="mr-2 inline h-5 w-5" />{t.settings.subscriptionUsage}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-md bg-slate-50 p-4 font-semibold">{company.subscriptionPlan} plan</div>
          <div className="rounded-md bg-slate-50 p-4 font-semibold">{usage.incidentsThisMonth} {t.settings.incidentsMonth}</div>
          <div className="rounded-md bg-slate-50 p-4 font-semibold">{usage.activeUsers} {t.settings.activeUsers}</div>
          <div className="rounded-md bg-slate-50 p-4 font-semibold">{usage.storageGb.toFixed(1)} {t.settings.storage}</div>
        </CardContent>
      </Card>
    </div>
  );
}
