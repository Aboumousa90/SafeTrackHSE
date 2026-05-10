"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Check, FileUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { departments, severityMatrix, users } from "@/lib/seed-data";
import type { SeverityCell } from "@/lib/types";
import { queueOfflineDraft } from "@/lib/offline/drafts";
import { generateReferenceNumber } from "@/lib/utils";

const injuryTypes = ["Laceration", "Fracture", "Burn", "Chemical exposure", "Strain"];
const draftStorageKey = "safetrack:incident-wizard-draft";
const maxUploadBytes = 10 * 1024 * 1024;
const allowedUploadTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

interface IncidentDraftForm {
  title: string;
  incidentDate: string;
  incidentTime: string;
  departmentId: string;
  involvedPersonName: string;
  reporterName: string;
  location: string;
  locationDetail: string;
  description: string;
  undesiredEvent: string;
  eventCategory: string;
  isVictim: boolean;
  injuryLocation: string;
  injuryType: string;
  isPse: boolean;
  productName: string;
  casNumber: string;
  sdsUrl: string;
  quantity: string;
  unit: "L" | "kg" | "m3";
  releaseDuration: string;
  containmentStatus: string;
  witnesses: string;
}

interface UploadedFileRecord {
  name: string;
  path: string;
  category: "photos" | "documents" | "sds";
  uploaded: boolean;
}

const initialForm: IncidentDraftForm = {
  title: "",
  incidentDate: "2026-05-09",
  incidentTime: "09:35",
  departmentId: departments[1]?.id ?? "",
  involvedPersonName: "",
  reporterName: "Elise Martens",
  location: "",
  locationDetail: "",
  description: "",
  undesiredEvent: "",
  eventCategory: "process safety",
  isVictim: true,
  injuryLocation: "",
  injuryType: "Chemical exposure",
  isPse: true,
  productName: "",
  casNumber: "1310-73-2",
  sdsUrl: "",
  quantity: "",
  unit: "L",
  releaseDuration: "",
  containmentStatus: "",
  witnesses: "",
};

export function IncidentWizard() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<IncidentDraftForm>(initialForm);
  const [selectedCell, setSelectedCell] = useState<SeverityCell>(severityMatrix[16]);
  const [status, setStatus] = useState<string>(t.incident.draftLoaded);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [submittedIncidentId, setSubmittedIncidentId] = useState<string>("draft");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reference = useMemo(() => generateReferenceNumber("STC", 44), []);
  const steps = [t.incident.basicFacts, t.incident.classification, t.incident.pseRelease, t.incident.attachments];

  useEffect(() => {
    const raw = window.localStorage.getItem(draftStorageKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { form?: IncidentDraftForm; selectedCell?: SeverityCell; uploadedFiles?: UploadedFileRecord[] };
      if (saved.form) setForm(saved.form);
      if (saved.selectedCell) setSelectedCell(saved.selectedCell);
      if (saved.uploadedFiles) setUploadedFiles(saved.uploadedFiles);
      setStatus(t.incident.restoredDraft);
    } catch {
      setStatus(t.incident.freshDraft);
    }
  }, [t.incident.freshDraft, t.incident.restoredDraft]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, selectedCell, uploadedFiles, savedAt: new Date().toISOString() }));
      setStatus(t.incident.autoSaved);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [form, selectedCell, uploadedFiles, t.incident.autoSaved]);

  function updateField<K extends keyof IncidentDraftForm>(field: K, value: IncidentDraftForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function saveLocalDraft(message = t.incident.savedLocally) {
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, selectedCell, uploadedFiles, savedAt: new Date().toISOString() }));
    setStatus(message);
  }

  async function uploadFile(file: File | undefined, category: UploadedFileRecord["category"]) {
    if (!file) return;

    if (file.size > maxUploadBytes) {
      setUploadStatus(`${file.name} exceeds the 10MB limit.`);
      return;
    }

    if (!allowedUploadTypes.has(file.type)) {
      setUploadStatus(`${file.name} has an unsupported file type.`);
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("incidentId", submittedIncidentId);
    body.append("category", category);

    setUploadStatus(`Uploading ${file.name}...`);
    const response = await fetch("/api/uploads", { method: "POST", body });
    const result = (await response.json()) as { path?: string; uploaded?: boolean; error?: string; demoMode?: boolean };

    if (!response.ok || !result.path) {
      setUploadStatus(result.error ?? "Upload failed.");
      return;
    }

    const uploadedPath = result.path;
    setUploadedFiles((current) => [
      ...current,
      {
        name: file.name,
        path: uploadedPath,
        category,
        uploaded: Boolean(result.uploaded),
      },
    ]);
    setUploadStatus(result.demoMode ? `${file.name} validated. Demo path reserved.` : `${file.name} uploaded.`);
  }

  async function submitDraft() {
    saveLocalDraft(t.incident.savingDraft);

    const payload = {
      ...form,
      companyPrefix: "STC",
      severityLevel: selectedCell.level,
      severityRationale: `${t.incident.likelihood} ${selectedCell.likelihood} ${t.incident.consequence} ${selectedCell.consequence} ${t.incident.mapsTo} ${selectedCell.level}.`,
      isUndesiredRelease: form.isPse,
      quantity: Number.parseFloat(form.quantity),
    };

    if (!navigator.onLine) {
      queueOfflineDraft(payload);
      setStatus(t.incident.queuedOffline);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        id?: string;
        referenceNumber?: string;
        error?: string;
        notification?: { queued?: boolean; sent?: boolean; demoMode?: boolean; recipients?: string[] };
      };

      if (!response.ok) {
        setStatus(result.error ?? "Unable to submit draft.");
        return;
      }

      window.localStorage.removeItem(draftStorageKey);
      if (result.id) setSubmittedIncidentId(result.id);
      const notificationText = result.notification?.sent
        ? "Notifications sent."
        : result.notification?.demoMode
          ? "Demo notifications queued."
          : "Notifications queued.";
      setStatus(`Draft submitted as ${result.referenceNumber}. ${notificationText}`);
    } catch {
      queueOfflineDraft(payload);
      setStatus(t.incident.networkQueued);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <Badge tone="blue">{t.incident.autoSave}</Badge>
          <h1 className="mt-3 font-heading text-3xl font-bold">{t.incident.title}</h1>
          <p className="mt-2 text-slate-600">{t.incident.reference} {reference}.</p>
          <p className="mt-2 text-sm font-semibold text-primary">{status}</p>
        </div>
        <Button onClick={() => saveLocalDraft()}>{t.incident.saveDraft}</Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-2 md:grid-cols-4">
            {steps.map((label, index) => (
              <button
                key={label}
                onClick={() => setStep(index)}
                className={`flex items-center gap-3 rounded-md border p-3 text-left text-sm font-semibold ${step === index ? "border-primary bg-blue-50 text-primary" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full ${step > index ? "bg-safe text-white" : "bg-slate-100"}`}>
                  {step > index ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {step === 0 ? (
        <Card>
          <CardHeader><CardTitle>{t.incident.stepBasic}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2"><Label>{t.incident.incidentTitle}</Label><Input value={form.title} onChange={(event) => updateField("title", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.date}</Label><Input type="date" value={form.incidentDate} onChange={(event) => updateField("incidentDate", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.time}</Label><Input type="time" value={form.incidentTime} onChange={(event) => updateField("incidentTime", event.target.value)} /></div>
            <div className="grid gap-2">
              <Label>{t.incident.department}</Label>
              <Select value={form.departmentId} onChange={(event) => updateField("departmentId", event.target.value)}>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t.incident.involvedPerson}</Label>
              <Input list="employees" value={form.involvedPersonName} onChange={(event) => updateField("involvedPersonName", event.target.value)} placeholder="Search employee or enter free text" />
              <datalist id="employees">{users.map((user) => <option key={user.id}>{user.fullName}</option>)}</datalist>
            </div>
            <div className="grid gap-2"><Label>{t.incident.reporter}</Label><Input value={form.reporterName} readOnly /></div>
            <div className="grid gap-2"><Label>{t.incident.location}</Label><Input value={form.location} onChange={(event) => updateField("location", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.specificLocation}</Label><Input value={form.locationDetail} onChange={(event) => updateField("locationDetail", event.target.value)} /></div>
            <div className="grid gap-2 lg:col-span-2">
              <Label>{t.incident.description}</Label>
              <Textarea minLength={100} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
              <p className="text-xs font-semibold text-slate-500">{form.description.length}/100 {t.incident.minimumChars}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>{t.incident.stepClassification}</CardTitle></CardHeader>
          <CardContent className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-2"><Label>{t.incident.undesiredEvent}</Label><Textarea value={form.undesiredEvent} onChange={(event) => updateField("undesiredEvent", event.target.value)} /></div>
              <div className="grid gap-2">
                <Label>{t.incident.category}</Label>
                <Select value={form.eventCategory} onChange={(event) => updateField("eventCategory", event.target.value)}>
                  <option>injury</option><option>near-miss</option><option>property damage</option><option>environmental</option><option>process safety</option>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div><p className="font-semibold">{t.incident.victimQuestion}</p><p className="text-sm text-slate-500">{t.incident.victimHelp}</p></div>
                <Button variant={form.isVictim ? "primary" : "secondary"} onClick={() => updateField("isVictim", !form.isVictim)}>{form.isVictim ? t.incident.yes : t.incident.no}</Button>
              </div>
              {form.isVictim ? (
                <div className="grid gap-4 rounded-lg bg-slate-50 p-4 md:grid-cols-[180px_1fr]">
                  <svg viewBox="0 0 140 260" className="h-64 w-full rounded-md bg-white">
                    <circle cx="70" cy="28" r="22" fill="#dbeafe" stroke="#1B4F72" />
                    <rect x="45" y="54" width="50" height="86" rx="22" fill="#dbeafe" stroke="#1B4F72" />
                    <rect x="20" y="60" width="22" height="90" rx="11" fill="#dbeafe" stroke="#1B4F72" />
                    <rect x="98" y="60" width="22" height="90" rx="11" fill="#fecaca" stroke="#E74C3C" />
                    <rect x="48" y="140" width="20" height="95" rx="10" fill="#dbeafe" stroke="#1B4F72" />
                    <rect x="72" y="140" width="20" height="95" rx="10" fill="#dbeafe" stroke="#1B4F72" />
                  </svg>
                  <div className="space-y-3">
                    <div className="grid gap-2"><Label>{t.incident.injuryLocation}</Label><Input value={form.injuryLocation} onChange={(event) => updateField("injuryLocation", event.target.value)} /></div>
                    <div className="grid gap-2">
                      <Label>{t.incident.injuryType}</Label>
                      <Select value={form.injuryType} onChange={(event) => updateField("injuryType", event.target.value)}>
                        {injuryTypes.map((type) => <option key={type}>{type}</option>)}
                      </Select>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-4">
              <div>
                <p className="font-semibold">{t.incident.severityMatrix}</p>
                <p className="text-sm text-slate-500">{t.incident.severityHelp}</p>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {severityMatrix.map((cell) => (
                  <button
                    key={cell.label}
                    onClick={() => setSelectedCell(cell)}
                    className={`aspect-square rounded-md border text-sm font-bold ${selectedCell.label === cell.label ? "border-primary ring-2 ring-primary/25" : "border-slate-200"} ${cell.level === "S1" ? "bg-red-100 text-red-800" : cell.level === "S2" ? "bg-amber-100 text-amber-800" : cell.level === "S3" ? "bg-yellow-100 text-yellow-800" : cell.level === "S4" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}
                  >
                    {cell.level}
                    <span className="block text-[10px] font-semibold">{cell.label}</span>
                  </button>
                ))}
              </div>
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <Badge tone={selectedCell.level === "S2" ? "amber" : selectedCell.level === "S1" ? "red" : "blue"}>{selectedCell.level}</Badge>
                <p className="mt-2 text-sm text-slate-600">{t.incident.rationale}: {t.incident.likelihood} {selectedCell.likelihood} {t.incident.consequence} {selectedCell.consequence} {t.incident.mapsTo} {selectedCell.level}.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <div><p className="font-semibold">{t.incident.processSafetyEvent}</p><p className="text-sm text-slate-500">{t.incident.processSafetyHelp}</p></div>
                <Button variant={form.isPse ? "primary" : "secondary"} onClick={() => updateField("isPse", !form.isPse)}>{form.isPse ? t.incident.yes : t.incident.no}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader><CardTitle>{t.incident.stepPse}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="grid gap-2"><Label>{t.incident.productName}</Label><Input value={form.productName} onChange={(event) => updateField("productName", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.casNumber}</Label><Input value={form.casNumber} onChange={(event) => updateField("casNumber", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.sdsUrl}</Label><Input value={form.sdsUrl} onChange={(event) => updateField("sdsUrl", event.target.value)} placeholder="https://..." /></div>
            <div className="grid gap-2">
              <Label>{t.incident.sdsUpload}</Label>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 text-sm font-semibold">
                <FileUp className="h-4 w-4" /> {t.incident.sdsUpload}
                <input className="sr-only" type="file" accept=".pdf,.docx,.xlsx,image/png,image/jpeg,image/webp" onChange={(event) => void uploadFile(event.target.files?.[0], "sds")} />
              </label>
            </div>
            <div className="grid gap-2"><Label>{t.incident.quantity}</Label><Input type="number" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.unit}</Label><Select value={form.unit} onChange={(event) => updateField("unit", event.target.value as IncidentDraftForm["unit"])}><option>L</option><option>kg</option><option>m3</option></Select></div>
            <div className="grid gap-2"><Label>{t.incident.releaseDuration}</Label><Input value={form.releaseDuration} onChange={(event) => updateField("releaseDuration", event.target.value)} /></div>
            <div className="grid gap-2"><Label>{t.incident.containmentStatus}</Label><Select value={form.containmentStatus} onChange={(event) => updateField("containmentStatus", event.target.value)}><option>Contained locally</option><option>Uncontained</option><option>Entered drain</option></Select></div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4 lg:col-span-2">
              <p className="font-semibold text-primary">{t.incident.aiSuggestion}</p>
              <p className="mt-1 text-sm text-slate-600">{t.incident.aiSuggestionPse}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardHeader><CardTitle>{t.incident.stepAttachments}</CardTitle></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <Camera className="h-6 w-6 text-primary" />
              <p className="mt-3 font-semibold">{t.incident.photos}</p>
              <p className="mt-1 text-sm text-slate-500">{t.incident.uploadLimitImages}</p>
              <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => void Promise.all(Array.from(event.target.files ?? []).map((file) => uploadFile(file, "photos")))} />
            </label>
            <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <FileUp className="h-6 w-6 text-primary" />
              <p className="mt-3 font-semibold">{t.incident.documents}</p>
              <p className="mt-1 text-sm text-slate-500">{t.incident.uploadLimitDocs}</p>
              <input className="sr-only" type="file" accept=".pdf,.docx,.xlsx,image/png,image/jpeg,image/webp" multiple onChange={(event) => void Promise.all(Array.from(event.target.files ?? []).map((file) => uploadFile(file, "documents")))} />
            </label>
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
              <Camera className="h-6 w-6 text-primary" />
              <p className="mt-3 font-semibold">{t.incident.witnesses}</p>
              <p className="mt-1 text-sm text-slate-500">{t.incident.witnessHelp}</p>
              <Input className="mt-3" value={form.witnesses} onChange={(event) => updateField("witnesses", event.target.value)} placeholder={t.incident.witnessHelp} />
            </div>
            <div className="lg:col-span-3">
              {uploadStatus ? <p className="rounded-md bg-blue-50 p-3 text-sm font-semibold text-primary">{uploadStatus}</p> : null}
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {uploadedFiles.map((file) => (
                  <div key={file.path} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">{file.name}</p>
                      <Badge tone={file.uploaded ? "green" : "blue"}>{file.uploaded ? t.incident.uploaded : t.incident.demo}</Badge>
                    </div>
                    <p className="mt-1 break-all text-xs text-slate-500">{file.path}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>{t.incident.back}</Button>
        <Button
          disabled={isSubmitting || form.description.length < 100}
          onClick={() => {
            if (step === steps.length - 1) {
              void submitDraft();
              return;
            }
            setStep((value) => Math.min(steps.length - 1, value + 1));
          }}
        >
          {step === steps.length - 1 ? (isSubmitting ? t.incident.submitting : t.incident.submitDraft) : t.incident.continue}
        </Button>
      </div>
    </div>
  );
}
