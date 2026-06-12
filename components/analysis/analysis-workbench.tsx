"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Download, Save, Send, Wand2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/i18n/language-provider";
import { Input } from "@/components/ui/field";
import { ANALYSIS_COMPLETE_MARKER } from "@/lib/ai/constants";
import { analysisFinding, incidents } from "@/lib/seed-data";
import type { AnalysisFinding, AnalysisMethod, SuggestedMeasure } from "@/lib/types";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

const methods: { id: AnalysisMethod; label: string }[] = [
  { id: "5why", label: "5x Waarom" },
  { id: "fishbone", label: "Fishbone" },
  { id: "fmea", label: "FMEA" },
  { id: "pareto", label: "Pareto" },
  { id: "fault_tree", label: "Fault Tree" },
  { id: "scatter", label: "Scatter" },
];

const pareto = [
  { cause: "Procedures", count: 9, cumulative: 45 },
  { cause: "Equipment", count: 5, cumulative: 70 },
  { cause: "People", count: 3, cumulative: 85 },
  { cause: "Organisation", count: 2, cumulative: 95 },
  { cause: "Environment", count: 1, cumulative: 100 },
];

const scatter = [
  { exposure: 2, incidents: 1 },
  { exposure: 4, incidents: 2 },
  { exposure: 5, incidents: 2 },
  { exposure: 8, incidents: 5 },
  { exposure: 9, incidents: 6 },
];

const findingLabels: Record<"nl" | "en" | "fr", Record<keyof AnalysisFinding, string>> = {
  nl: {
    directCauses: "Directe oorzaken",
    underlyingCauses: "Onderliggende oorzaken",
    rootCauses: "Basisoorzaken",
    contributingFactors: "Bijdragende factoren",
  },
  en: {
    directCauses: "Direct causes",
    underlyingCauses: "Underlying causes",
    rootCauses: "Root causes",
    contributingFactors: "Contributing factors",
  },
  fr: {
    directCauses: "Causes directes",
    underlyingCauses: "Causes sous-jacentes",
    rootCauses: "Causes racines",
    contributingFactors: "Facteurs contributifs",
  },
};

const visualLabels = {
  nl: {
    bones: ["Mens", "Machine", "Methode", "Materiaal", "Omgeving", "Management"],
    rootCause: "Basisoorzaak in analyse",
    why: "Waarom",
    answer: "Antwoord",
    whySteps: ["Waarom vond de vrijzetting plaats?", "Waarom was de koppeling niet geborgd?", "Waarom was het systeem zwak?"],
    fmea: ["Functie", "Faalwijze", "Effect", "Oorzaak", "RPN"],
    transfer: "Chemische transfer",
    couplingRelease: "Loskomen koppeling",
    splashExposure: "Spatblootstelling",
    exposureHours: "Blootstellingsuren",
    topEvent: "Topgebeurtenis: chemische spatblootstelling",
    orGate: "OF-poort",
  },
  en: {
    bones: ["Man", "Machine", "Method", "Material", "Environment", "Management"],
    rootCause: "Root cause under analysis",
    why: "Why",
    answer: "Answer",
    whySteps: ["Why did release occur?", "Why was coupling not secured?", "Why was the system weak?"],
    fmea: ["Function", "Failure mode", "Effect", "Cause", "RPN"],
    transfer: "Chemical transfer",
    couplingRelease: "Coupling release",
    splashExposure: "Splash exposure",
    exposureHours: "Exposure hours",
    topEvent: "Top event: Chemical splash",
    orGate: "OR gate",
  },
  fr: {
    bones: ["Humain", "Machine", "Methode", "Matiere", "Environnement", "Management"],
    rootCause: "Cause racine en analyse",
    why: "Pourquoi",
    answer: "Reponse",
    whySteps: ["Pourquoi le rejet s'est-il produit ?", "Pourquoi le raccord n'etait-il pas securise ?", "Pourquoi le systeme etait-il faible ?"],
    fmea: ["Fonction", "Mode de defaillance", "Effet", "Cause", "RPN"],
    transfer: "Transfert chimique",
    couplingRelease: "Desserrage du raccord",
    splashExposure: "Exposition par eclaboussure",
    exposureHours: "Heures d'exposition",
    topEvent: "Evenement sommet : eclaboussure chimique",
    orGate: "Porte OU",
  },
} as const;

export function AnalysisWorkbench() {
  const { locale, t } = useLanguage();
  const [method, setMethod] = useState<AnalysisMethod>("fishbone");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [finding, setFinding] = useState<AnalysisFinding>(analysisFinding);
  const [suggestions, setSuggestions] = useState<SuggestedMeasure[]>([]);
  const [status, setStatus] = useState(t.analysis.ready);
  const incident = incidents[0];
  const storageKey = useMemo(() => `safetrack:analysis:${incident.id}:${method}:${locale}`, [incident.id, method, locale]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { messages?: ChatMessage[]; finding?: AnalysisFinding; suggestions?: SuggestedMeasure[] };
        if (saved.messages?.length) {
          setMessages(saved.messages);
        } else {
          setMessages([createOpeningMessage(method, locale)]);
        }
        if (saved.finding) setFinding(saved.finding);
        if (saved.suggestions) setSuggestions(saved.suggestions);
        setStatus(t.analysis.restored);
        return;
      } catch {
        setStatus(t.analysis.fresh);
      }
    }

    setMessages([createOpeningMessage(method, locale)]);
  }, [method, storageKey, locale, t.analysis.fresh, t.analysis.restored]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify({ messages, finding, suggestions, savedAt: new Date().toISOString() }));
  }, [messages, finding, suggestions, storageKey]);

  function buildRequestPayload(conversation: ChatMessage[]) {
    return {
      language: locale,
      method,
      incident: {
        description: incident.description,
        date: incident.incidentDate,
        department: "Production Line A",
        severityLevel: incident.severityLevel,
        isPse: incident.isPse,
        isVictim: incident.isVictim,
        injuryLocation: incident.injuryLocation,
      },
      messages: conversation.map((message) => ({ role: message.role, content: message.content })),
    };
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isTyping) return;

    const nextMessages: ChatMessage[] = [...messages, { id: crypto.randomUUID(), role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);
    setStatus(locale === "nl" ? "AI-begeleider analyseert je antwoord..." : locale === "fr" ? "Le facilitateur IA analyse votre reponse..." : "AI facilitator is analysing your answer...");

    try {
      const response = await fetch("/api/ai/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestPayload(nextMessages)),
      });

      if (!response.ok || !response.body) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setStatus(result?.error ?? t.analysis.requestFailed);
        return;
      }

      const demoMode = response.headers.get("X-SafeTrack-Demo") === "1";
      const remaining = response.headers.get("X-RateLimit-Remaining") ?? "0";

      const assistantId = crypto.randomUUID();
      setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        const snapshot = content;
        setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, content: snapshot } : message)));
      }
      content += decoder.decode();
      setMessages((current) => current.map((message) => (message.id === assistantId ? { ...message, content } : message)));

      if (content.includes(ANALYSIS_COMPLETE_MARKER)) {
        const completedConversation: ChatMessage[] = [...nextMessages, { id: assistantId, role: "assistant", content }];
        await synthesizeFinding(completedConversation);
      } else {
        setStatus(demoMode ? t.analysis.demoResponse : `${t.analysis.responseReceived} ${remaining}.`);
      }
    } catch {
      setStatus(t.analysis.requestFailed);
    } finally {
      setIsTyping(false);
    }
  }

  async function synthesizeFinding(conversation: ChatMessage[]) {
    setStatus(
      locale === "nl"
        ? "Gestructureerde bevindingen samenstellen..."
        : locale === "fr"
          ? "Synthèse des constats structurés..."
          : "Synthesising structured findings...",
    );

    const response = await fetch("/api/ai/root-cause/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildRequestPayload(conversation)),
    });
    const result = (await response.json().catch(() => null)) as { finding?: AnalysisFinding; error?: string } | null;

    if (!response.ok || !result?.finding) {
      setStatus(result?.error ?? t.analysis.requestFailed);
      return;
    }

    setFinding(result.finding);
    setStatus(t.analysis.completed);
  }

  async function exportPng() {
    const svg = buildExportSvg(method, incident.title, finding, locale);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const anchor = document.createElement("a");
      anchor.href = canvas.toDataURL("image/png");
      anchor.download = `${incident.referenceNumber}-${method}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    };
    image.src = url;
  }

  async function saveAnalysis() {
    setStatus(t.analysis.saving);
    const response = await fetch("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: incident.id,
        method,
        messages: messages.map((message) => ({ role: message.role, content: message.content })),
        finding,
        analysisData: { visualMethod: method },
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string; demoMode?: boolean };
    if (!response.ok) {
      setStatus(result.error ?? t.analysis.saveFailed);
      return;
    }
    setStatus(result.demoMode ? `${t.analysis.savedLocal} (${result.id}).` : `${t.analysis.saved} (${result.id}).`);
  }

  async function generateMeasures() {
    setStatus(t.analysis.generatingMeasures);
    const response = await fetch("/api/measures/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incidentId: incident.id, incidentDescription: incident.description, finding, language: locale }),
    });
    const result = (await response.json()) as { suggestions?: SuggestedMeasure[]; error?: string };
    if (!response.ok || !result.suggestions) {
      setStatus(result.error ?? t.analysis.measureFailed);
      return;
    }
    setSuggestions(result.suggestions);
    setStatus(locale === "nl" ? `${result.suggestions.length} MUOPO-maatregelsuggesties gegenereerd.` : locale === "fr" ? `${result.suggestions.length} mesures MUOPO proposees generees.` : `Generated ${result.suggestions.length} MUOPO measure suggestions.`);
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <Badge tone="blue">{t.analysis.badge}</Badge>
        <h1 className="mt-3 font-heading text-3xl font-bold">{t.analysis.title}</h1>
        <p className="mt-2 text-slate-600">{t.analysis.description}</p>
        <p className="mt-2 text-sm font-semibold text-primary">{status}</p>
      </div>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader><CardTitle>{t.analysis.methodSelection}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {methods.map((item) => (
                <button key={item.id} onClick={() => setMethod(item.id)} className={`rounded-md border px-3 py-2 text-sm font-semibold ${method === item.id ? "border-primary bg-blue-50 text-primary" : "border-slate-200 bg-white"}`}>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="rounded-md bg-slate-50 p-4">
              <p className="text-xs font-bold text-primary">{incident.referenceNumber}</p>
              <p className="mt-1 font-semibold">{incident.title}</p>
              <p className="mt-2 text-sm text-slate-600">{incident.description}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.analysis.conversation}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[430px] space-y-3 overflow-y-auto rounded-lg bg-slate-50 p-4">
              {messages.map((message) => (
                message.role === "assistant" ? (
                  <div key={message.id} className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-white"><Bot className="h-4 w-4" /></div>
                    <div className="whitespace-pre-wrap rounded-md bg-white p-3 text-sm shadow-sm">{message.content}</div>
                  </div>
                ) : (
                  <div key={message.id} className="ml-auto max-w-[80%] whitespace-pre-wrap rounded-md bg-primary p-3 text-sm text-white">{message.content}</div>
                )
              ))}
              {isTyping ? <div className="text-sm font-semibold text-slate-500">{t.analysis.typing}</div> : null}
            </div>
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendMessage();
                }}
                placeholder={t.analysis.answerPlaceholder}
              />
              <Button disabled={isTyping || !input.trim()} onClick={() => void sendMessage()}><Send className="h-4 w-4" />{t.analysis.send}</Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t.analysis.visualOutput} - {methods.find((item) => item.id === method)?.label}</CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void saveAnalysis()}><Save className="h-4 w-4" />{t.analysis.save}</Button>
                <Button variant="secondary" onClick={() => void exportPng()}><Download className="h-4 w-4" />PNG</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>{renderVisual(method, finding, locale)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.analysis.structuredFindings}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(finding).map(([label, values]) => (
              <div key={label}>
                <p className="text-sm font-bold text-slate-700">{findingLabels[locale][label as keyof AnalysisFinding]}</p>
                <ul className="mt-2 space-y-2">
                  {(values as string[]).map((value) => <li key={value} className="rounded-md bg-slate-50 p-2 text-sm text-slate-600">{value}</li>)}
                </ul>
              </div>
            ))}
            <Button className="w-full" onClick={() => void generateMeasures()}><Wand2 className="h-4 w-4" />{t.analysis.generateMeasures}</Button>
            {suggestions.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-700">{t.analysis.suggestedMeasures}</p>
                {suggestions.slice(0, 6).map((suggestion) => (
                  <div key={suggestion.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={suggestion.priority === "immediate" ? "red" : suggestion.priority === "short_term" ? "amber" : "blue"}>{suggestion.muopoCategory}</Badge>
                      <Badge>{suggestion.priority}</Badge>
                      <span className="text-xs font-semibold text-slate-500">{suggestion.suggestedResponsibleRole} · {suggestion.estimatedEffort}</span>
                    </div>
                    <p className="mt-2 text-slate-700">{suggestion.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function createOpeningMessage(method: AnalysisMethod, locale: "nl" | "en" | "fr"): ChatMessage {
  const content = {
    nl: `Ik begrijp dat het gaat om een bijtende vrijzetting tijdens een transfer, met potentiele ernst S2 en een lichte spatblootstelling aan de onderarm. We gebruiken de methode ${method}. Ik stel telkens een gerichte vraag. Welke beheersmaatregel had moeten voorkomen dat de koppeling loskwam?`,
    en: `I understand this was a caustic release during transfer, with S2 potential severity and a minor forearm splash. We will use ${method}. I will ask one focused question at a time. What control was expected to prevent coupling release?`,
    fr: `Je comprends qu'il s'agit d'un rejet caustique pendant un transfert, avec une gravite potentielle S2 et une legere eclaboussure a l'avant-bras. Nous utiliserons la methode ${method}. Je poserai une question ciblee a la fois. Quelle mesure de maitrise devait prevenir le desserrage du raccord ?`,
  };

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: content[locale],
  };
}

function renderVisual(method: AnalysisMethod, finding: AnalysisFinding, locale: "nl" | "en" | "fr") {
  const labels = visualLabels[locale];
  if (method === "fishbone") {
    const bones = labels.bones;
    return (
      <svg viewBox="0 0 820 360" className="h-[360px] w-full rounded-lg bg-white">
        <line x1="110" y1="180" x2="740" y2="180" stroke="#1B4F72" strokeWidth="5" />
        <polygon points="740,180 695,155 695,205" fill="#1B4F72" />
        {bones.map((bone, index) => {
          const top = index % 2 === 0;
          const x = 190 + index * 85;
          const y = top ? 76 : 284;
          return (
            <g key={bone}>
              <line x1={x} y1="180" x2={x + 70} y2={y} stroke="#1B4F72" strokeWidth="3" />
              <rect x={x + 42} y={top ? y - 34 : y + 8} width="126" height="30" rx="5" fill="#EFF6FF" stroke="#BFDBFE" />
              <text x={x + 105} y={top ? y - 14 : y + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1B4F72">{bone}</text>
            </g>
          );
        })}
        <text x="412" y="174" textAnchor="middle" fontSize="14" fontWeight="700" fill="#17202A">{finding.rootCauses[0] ?? labels.rootCause}</text>
      </svg>
    );
  }

  if (method === "5why") {
    const steps = [labels.whySteps[0], finding.directCauses[0], labels.whySteps[1], finding.underlyingCauses[0], labels.whySteps[2], finding.rootCauses[0]].filter(Boolean);
    return <div className="space-y-3">{steps.map((item, index) => <div key={String(item)} className="rounded-md border border-slate-200 bg-slate-50 p-3"><Badge>{index % 2 === 0 ? labels.why : labels.answer}</Badge><p className="mt-2 font-semibold">{item}</p></div>)}</div>;
  }

  if (method === "fmea") {
    return <table className="w-full text-left text-sm"><thead><tr className="border-b">{labels.fmea.map((label) => <th key={label} className="py-2">{label}</th>)}</tr></thead><tbody><tr className="border-b"><td className="py-2">{labels.transfer}</td><td>{labels.couplingRelease}</td><td>{labels.splashExposure}</td><td>{finding.rootCauses[0]}</td><td><Badge tone="red">168</Badge></td></tr></tbody></table>;
  }

  if (method === "pareto") {
    return <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={pareto}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="cause" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Bar yAxisId="left" dataKey="count" fill="#1B4F72" /><Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#E74C3C" strokeWidth={3} /></BarChart></ResponsiveContainer></div>;
  }

  if (method === "scatter") {
    return <div className="h-80"><ResponsiveContainer width="100%" height="100%"><ScatterChart><CartesianGrid /><XAxis dataKey="exposure" name={labels.exposureHours} /><YAxis dataKey="incidents" name={locale === "nl" ? "Incidenten" : locale === "fr" ? "Incidents" : "Incidents"} /><Tooltip cursor={{ strokeDasharray: "3 3" }} /><Scatter data={scatter} fill="#1B4F72" /></ScatterChart></ResponsiveContainer></div>;
  }

  return (
    <div className="flex justify-center py-6">
      <div className="space-y-4 text-center">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 font-bold">{labels.topEvent}</div>
        <div className="mx-auto h-8 w-px bg-slate-300" />
        <div className="rounded-md border border-slate-200 bg-white p-3">{labels.orGate}</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">{finding.directCauses[0]}</div>
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">{finding.contributingFactors[0]}</div>
        </div>
      </div>
    </div>
  );
}

function buildExportSvg(method: AnalysisMethod, title: string, finding: AnalysisFinding, locale: "nl" | "en" | "fr") {
  const exportLabels = {
    nl: {
      title: "SafeTrack oorzaakanalyse",
      method: "Methode",
      incident: "Incident",
      direct: "Directe oorzaak",
      underlying: "Onderliggende oorzaak",
      root: "Basisoorzaak",
      factor: "Bijdragende factor",
    },
    en: {
      title: "SafeTrack Root Cause Analysis",
      method: "Method",
      incident: "Incident",
      direct: "Direct cause",
      underlying: "Underlying cause",
      root: "Root cause",
      factor: "Contributing factor",
    },
    fr: {
      title: "Analyse des causes racines SafeTrack",
      method: "Methode",
      incident: "Incident",
      direct: "Cause directe",
      underlying: "Cause sous-jacente",
      root: "Cause racine",
      factor: "Facteur contributif",
    },
  }[locale];
  const rows = [
    [exportLabels.method, method],
    [exportLabels.incident, title],
    [exportLabels.direct, finding.directCauses[0] ?? ""],
    [exportLabels.underlying, finding.underlyingCauses[0] ?? ""],
    [exportLabels.root, finding.rootCauses[0] ?? ""],
    [exportLabels.factor, finding.contributingFactors[0] ?? ""],
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
    <rect width="1280" height="720" fill="#ffffff"/>
    <rect x="0" y="0" width="1280" height="92" fill="#1B4F72"/>
    <text x="48" y="58" font-family="Arial" font-size="34" font-weight="700" fill="#ffffff">${escapeXml(exportLabels.title)}</text>
    ${rows.map((row, index) => {
      const y = 150 + index * 82;
      return `<text x="64" y="${y}" font-family="Arial" font-size="22" font-weight="700" fill="#1B4F72">${escapeXml(row[0])}</text>
      <text x="330" y="${y}" font-family="Arial" font-size="22" fill="#17202A">${escapeXml(row[1]).slice(0, 90)}</text>`;
    }).join("")}
  </svg>`;
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };
    return entities[character];
  });
}
