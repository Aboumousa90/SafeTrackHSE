"use client";

import { useState } from "react";
import { Camera, CheckCircle2, Construction, Eye, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { Department, ProactiveReport, ProactiveReportType, RiskLevel, TenantUser } from "@/lib/types";

const reportTypes: Array<{ labelKey: "nearMiss" | "unsafeCondition" | "unsafeAct" | "positiveObservation"; value: ProactiveReportType; icon: typeof ShieldAlert }> = [
  { labelKey: "nearMiss", value: "near_miss", icon: ShieldAlert },
  { labelKey: "unsafeCondition", value: "unsafe_condition", icon: Construction },
  { labelKey: "unsafeAct", value: "unsafe_act", icon: Eye },
  { labelKey: "positiveObservation", value: "positive_observation", icon: CheckCircle2 },
];

export function ProactiveWorkspace({
  departments,
  users,
  initialReports,
}: {
  departments: Department[];
  users: TenantUser[];
  initialReports: ProactiveReport[];
}) {
  const { t } = useLanguage();
  const [reports, setReports] = useState(initialReports);
  const [reportType, setReportType] = useState<ProactiveReportType>("near_miss");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [anonymous, setAnonymous] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState(t.proactive.statusReady);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setStatus("Photo exceeds 10MB limit.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setStatus("Unsupported photo type.");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("incidentId", "proactive");
    body.append("category", "photos");

    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as { path?: string; error?: string; demoMode?: boolean };
    if (!response.ok || !result.path) {
      setStatus(result.error ?? "Photo upload failed.");
      return;
    }

    setPhotoUrl(result.path);
    setStatus(result.demoMode ? "Photo validated in demo mode." : "Photo uploaded.");
  }

  async function submitReport() {
    const response = await fetch("/api/proactive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ departmentId, reportType, description, location, photoUrl, riskLevel, anonymous }),
    });
    const result = (await response.json()) as { report?: ProactiveReport; error?: string; notificationQueued?: boolean };
    if (!response.ok || !result.report) {
      setStatus(result.error ?? "Unable to submit proactive report.");
      return;
    }

    setReports((current) => [result.report as ProactiveReport, ...current]);
    setDescription("");
    setLocation("");
    setPhotoUrl(null);
    setStatus(result.notificationQueued ? t.proactive.highRiskQueued : t.proactive.submitted);
  }

  async function updateReport(id: string, nextStatus: ProactiveReport["status"]) {
    const previous = reports;
    setReports((current) => current.map((report) => (report.id === id ? { ...report, status: nextStatus } : report)));
    const response = await fetch("/api/proactive", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus, assignedTo: users[0]?.id, actionTaken: nextStatus === "closed" ? "Follow-up action recorded." : "" }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setReports(previous);
      setStatus(result.error ?? "Unable to update proactive report.");
      return;
    }
    setStatus(`Report moved to ${nextStatus.replace("_", " ")}.`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t.proactive.title}</CardTitle>
          <p className="text-sm font-semibold text-primary">{status}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {reportTypes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  onClick={() => setReportType(item.value)}
                  className={`flex items-center gap-2 rounded-md border p-3 text-sm font-semibold ${reportType === item.value ? "border-primary bg-blue-50 text-primary" : "border-slate-200"}`}
                >
                  <Icon className="h-4 w-4" />{t.proactive[item.labelKey]}
                </button>
              );
            })}
          </div>
          <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t.proactive.location} />
          <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</Select>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t.proactive.shortDescription} />
          <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold">
            <Camera className="h-4 w-4" /> {photoUrl ? t.proactive.photoAttached : t.proactive.cameraUpload}
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => void uploadPhoto(event.target.files?.[0])} />
          </label>
          <Select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}><option>low</option><option>medium</option><option>high</option><option>critical</option></Select>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> {t.proactive.anonymous}</label>
          <Button className="w-full" disabled={!location || description.length < 10} onClick={() => void submitReport()}>{t.proactive.submit}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t.proactive.supervisorFeed}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-md border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={report.riskLevel === "critical" || report.riskLevel === "high" ? "red" : report.riskLevel === "medium" ? "amber" : "green"}>{report.riskLevel}</Badge>
                <Badge>{report.reportType.replace("_", " ")}</Badge>
                <Badge>{report.status}</Badge>
                {report.photoUrl ? <Badge tone="blue">{t.proactive.photo}</Badge> : null}
              </div>
              <p className="mt-3 font-semibold">{report.description}</p>
              <p className="mt-1 text-sm text-slate-500">{report.location} - {report.anonymous ? t.proactive.anonymous : t.proactive.namedReporter}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["open", "in_progress", "closed"] as const).filter((statusItem) => statusItem !== report.status).map((statusItem) => (
                  <button key={statusItem} onClick={() => void updateReport(report.id, statusItem)} className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold hover:border-primary hover:text-primary">
                    {statusItem.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
