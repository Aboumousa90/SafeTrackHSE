"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleDot, ClipboardCheck, FileUp, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import type { Measure, MeasureStatus, SuggestedMeasure, TenantUser } from "@/lib/types";

export function MeasuresBoard({
  initialMeasures,
  initialSuggestions,
  users,
}: {
  initialMeasures: Measure[];
  initialSuggestions: SuggestedMeasure[];
  users: TenantUser[];
}) {
  const { t } = useLanguage();
  const [measures, setMeasures] = useState(initialMeasures);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [status, setStatus] = useState(t.measures.statusReady);
  const columns: { status: MeasureStatus; label: string; icon: typeof CircleDot }[] = [
    { status: "open", label: t.measures.open, icon: CircleDot },
    { status: "in_progress", label: t.measures.inProgress, icon: ClipboardCheck },
    { status: "completed", label: t.measures.completed, icon: CheckCircle2 },
    { status: "verified", label: t.measures.verified, icon: ShieldCheck },
  ];
  const defaultOwner = users.find((user) => user.role === "hse_manager") ?? users[0];
  const defaultDueDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  }, []);

  async function acceptSuggestion(suggestion: SuggestedMeasure) {
    const response = await fetch("/api/measures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: suggestion.id,
        incidentId: suggestion.incidentId,
        muopoCategory: suggestion.muopoCategory,
        description: suggestion.description,
        priority: suggestion.priority,
        responsiblePersonId: defaultOwner.id,
        dueDate: defaultDueDate,
      }),
    });
    const result = (await response.json()) as { measure?: Measure; error?: string };
    if (!response.ok || !result.measure) {
      setStatus(result.error ?? "Unable to accept suggestion.");
      return;
    }
    setMeasures((current) => [result.measure as Measure, ...current]);
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    setStatus("Suggestion accepted as an open measure.");
  }

  async function moveMeasure(id: string, nextStatus: MeasureStatus) {
    const previous = measures;
    const now = new Date().toISOString();
    setMeasures((current) => current.map((measure) => (
      measure.id === id
        ? {
            ...measure,
            status: nextStatus,
            completedAt: nextStatus === "completed" ? now : measure.completedAt,
            verifiedAt: nextStatus === "verified" ? now : measure.verifiedAt,
            verifiedBy: nextStatus === "verified" ? defaultOwner.id : measure.verifiedBy,
          }
        : measure
    )));
    const response = await fetch("/api/measures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nextStatus }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMeasures(previous);
      setStatus(result.error ?? "Unable to update measure status.");
      return;
    }
    setStatus(`Measure moved to ${nextStatus.replace("_", " ")}.`);
  }

  async function uploadEvidence(measureId: string, file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.append("measureId", measureId);
    body.append("file", file);

    setStatus(`Uploading evidence for measure ${measureId}...`);
    const uploadResponse = await fetch("/api/measures/evidence", { method: "POST", body });
    const uploadResult = (await uploadResponse.json()) as { path?: string; error?: string; demoMode?: boolean };

    if (!uploadResponse.ok || !uploadResult.path) {
      setStatus(uploadResult.error ?? "Unable to upload evidence.");
      return;
    }

    const previous = measures;
    setMeasures((current) => current.map((measure) => (measure.id === measureId ? { ...measure, evidenceUrl: uploadResult.path } : measure)));
    const patchResponse = await fetch("/api/measures", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: measureId, evidenceUrl: uploadResult.path }),
    });
    const patchResult = (await patchResponse.json()) as { error?: string };

    if (!patchResponse.ok) {
      setMeasures(previous);
      setStatus(patchResult.error ?? "Unable to attach evidence.");
      return;
    }

    setStatus(uploadResult.demoMode ? "Evidence validated and attached in demo mode." : "Evidence uploaded and attached.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">{t.measures.title}</h1>
        <p className="mt-2 text-slate-600">{t.measures.description}</p>
        <p className="mt-2 text-sm font-semibold text-primary">{status}</p>
      </div>
      {suggestions.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{t.measures.suggestions}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-3">
            {suggestions.slice(0, 6).map((suggestion) => (
              <div key={suggestion.id} className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={suggestion.priority === "immediate" ? "red" : "blue"}>{suggestion.muopoCategory}</Badge>
                  <Badge>{suggestion.priority}</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold">{suggestion.description}</p>
                <p className="mt-2 text-xs text-slate-600">{suggestion.suggestedResponsibleRole} · {suggestion.estimatedEffort} effort</p>
                <Button className="mt-3 w-full" onClick={() => void acceptSuggestion(suggestion)}>{t.measures.accept}</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const Icon = column.icon;
          return (
            <Card key={column.status}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5 text-primary" />{column.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {measures.filter((measure) => measure.status === column.status).map((measure) => (
                  <div key={measure.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={measure.priority === "immediate" ? "red" : "amber"}>{measure.muopoCategory}</Badge>
                        {isOverdue(measure) ? <Badge tone="red">{t.measures.overdue}</Badge> : null}
                        {measure.evidenceUrl ? <Badge tone="green">{t.measures.evidence}</Badge> : null}
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{measure.dueDate}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{measure.description}</p>
                    <p className="mt-2 text-xs text-slate-500">{t.measures.owner}: {users.find((user) => user.id === measure.responsiblePersonId)?.fullName ?? "Unassigned"}</p>
                    {measure.completedAt ? <p className="mt-1 text-xs text-slate-500">Completed: {formatDateTime(measure.completedAt)}</p> : null}
                    {measure.verifiedAt ? <p className="mt-1 text-xs text-slate-500">Verified: {formatDateTime(measure.verifiedAt)}</p> : null}
                    {measure.evidenceUrl ? <p className="mt-2 break-all text-xs text-slate-500">{measure.evidenceUrl}</p> : null}
                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary">
                      <FileUp className="h-4 w-4" />
                      {t.measures.evidence}
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,application/pdf"
                        onChange={(event) => void uploadEvidence(measure.id, event.target.files?.[0])}
                      />
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {columns.filter((target) => target.status !== measure.status).map((target) => (
                        <button
                          key={target.status}
                          onClick={() => void moveMeasure(measure.id, target.status)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:border-primary hover:text-primary"
                        >
                          {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function isOverdue(measure: Measure) {
  if (measure.status === "completed" || measure.status === "verified") return false;
  return new Date(measure.dueDate) < new Date();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("nl-BE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
