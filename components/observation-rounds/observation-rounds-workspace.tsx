"use client";

import { useMemo, useState } from "react";
import { Camera, ClipboardCheck, ShieldAlert, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { Input, Select, Textarea } from "@/components/ui/field";
import type { Department, ObservationItem, ObservationRound, ObservationStatus, TenantUser } from "@/lib/types";

const checklist = ["PPE compliance", "Housekeeping", "Machine guarding", "Work procedures", "Emergency equipment", "Employee behaviour"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  return new Date().toTimeString().slice(0, 5);
}

function createChecklist(): ObservationItem[] {
  return checklist.map((category) => ({ category, status: "ok", comment: "", photoUrl: null }));
}

export function ObservationRoundsWorkspace({
  departments,
  users,
  initialRounds,
}: {
  departments: Department[];
  users: TenantUser[];
  initialRounds: ObservationRound[];
}) {
  const { t } = useLanguage();
  const [rounds, setRounds] = useState(initialRounds);
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [roundDate, setRoundDate] = useState(today());
  const [roundTime, setRoundTime] = useState(currentTime());
  const [location, setLocation] = useState("");
  const [observations, setObservations] = useState<ObservationItem[]>(createChecklist);
  const [overallScore, setOverallScore] = useState(4);
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState(t.rounds.statusReady);

  const notOkCount = useMemo(() => observations.filter((observation) => observation.status === "not_ok").length, [observations]);
  const effectiveFollowUp = followUpRequired || notOkCount > 0;

  function updateObservation(index: number, update: Partial<ObservationItem>) {
    setObservations((current) => current.map((observation, itemIndex) => (itemIndex === index ? { ...observation, ...update } : observation)));
  }

  async function uploadPhoto(index: number, file: File | undefined) {
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
    body.append("incidentId", "observation-round");
    body.append("category", "photos");

    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as { path?: string; error?: string; demoMode?: boolean };
    if (!response.ok || !result.path) {
      setStatus(result.error ?? "Photo upload failed.");
      return;
    }

    updateObservation(index, { photoUrl: result.path });
    setStatus(result.demoMode ? "Photo validated in demo mode." : "Photo uploaded.");
  }

  async function saveRound() {
    const response = await fetch("/api/observation-rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        departmentId,
        roundDate,
        roundTime,
        location,
        observations,
        overallScore,
        followUpRequired: effectiveFollowUp,
        notes,
      }),
    });
    const result = (await response.json()) as { round?: ObservationRound; followUpsCreated?: number; error?: string };
    if (!response.ok || !result.round) {
      setStatus(result.error ?? "Unable to save observation round.");
      return;
    }

    setRounds((current) => [result.round as ObservationRound, ...current]);
    setLocation("");
    setObservations(createChecklist());
    setOverallScore(4);
    setFollowUpRequired(false);
    setNotes("");
    setStatus(result.followUpsCreated ? `${t.rounds.saved} ${result.followUpsCreated} ${t.rounds.followUpsCreated}` : t.rounds.saved);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t.rounds.title}</CardTitle>
          <p className="text-sm font-semibold text-primary">{status}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input type="date" value={roundDate} onChange={(event) => setRoundDate(event.target.value)} />
            <Input type="time" value={roundTime} onChange={(event) => setRoundTime(event.target.value)} />
            <Input placeholder={t.rounds.location} value={location} onChange={(event) => setLocation(event.target.value)} />
            <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </Select>
          </div>

          <div className="space-y-2">
            {observations.map((observation, index) => (
              <div key={observation.category} className="rounded-md border border-slate-200 p-3">
                <div className="grid gap-2 md:grid-cols-[1fr_140px_44px] md:items-center">
                  <p className="font-semibold">{observation.category}</p>
                  <Select value={observation.status} onChange={(event) => updateObservation(index, { status: event.target.value as ObservationStatus })}>
                    <option value="ok">OK</option>
                    <option value="not_ok">{t.rounds.notOk}</option>
                    <option value="na">N/A</option>
                  </Select>
                  <label className="flex h-10 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-slate-50" title="Attach photo">
                    <Camera className={`h-4 w-4 ${observation.photoUrl ? "text-primary" : "text-slate-500"}`} />
                    <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" onChange={(event) => void uploadPhoto(index, event.target.files?.[0])} />
                  </label>
                </div>
                <Textarea
                  className="mt-2 min-h-16"
                  placeholder={observation.status === "not_ok" ? t.rounds.requiredComment : t.rounds.comment}
                  value={observation.comment}
                  onChange={(event) => updateObservation(index, { comment: event.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-50 p-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">{t.rounds.cultureScore}</p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((score) => (
                  <button key={score} onClick={() => setOverallScore(score)} title={`${score} stars`}>
                    <Star className={`h-6 w-6 ${score <= overallScore ? "fill-warning text-warning" : "text-slate-300"}`} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={followUpRequired} onChange={(event) => setFollowUpRequired(event.target.checked)} />
              {t.rounds.followUpRequired}
            </label>
          </div>

          <Textarea placeholder={t.rounds.notes} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button className="w-full" disabled={!location || !departmentId} onClick={() => void saveRound()}>{t.rounds.save}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.rounds.recent}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rounds.map((round) => {
            const observer = users.find((user) => user.id === round.observerId);
            const department = departments.find((item) => item.id === round.departmentId);
            const issues = round.observations.filter((observation) => observation.status === "not_ok");
            return (
              <div key={round.id} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-primary" />
                    <p className="font-semibold">{round.location}</p>
                  </div>
                  <Badge tone={round.followUpRequired ? "amber" : "green"}>{round.followUpRequired ? t.rounds.followUp : t.rounds.clear}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{round.roundDate} {round.roundTime} &middot; {department?.name ?? "Department"} &middot; {observer?.fullName ?? "Observer"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="blue">{t.rounds.score} {round.overallScore}/5</Badge>
                  <Badge tone={issues.length > 0 ? "red" : "green"}>{issues.length} {t.rounds.notOk}</Badge>
                  <Badge>{round.observations.length} {t.rounds.checks}</Badge>
                </div>
                {issues.length > 0 ? (
                  <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-900">
                    <div className="mb-1 flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> {t.rounds.followUpItems}</div>
                    {issues.map((issue) => (
                      <p key={`${round.id}-${issue.category}`}>{issue.category}: {issue.comment || "Corrective action required."}</p>
                    ))}
                  </div>
                ) : null}
                {round.notes ? <p className="mt-3 text-sm text-slate-600">{round.notes}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
