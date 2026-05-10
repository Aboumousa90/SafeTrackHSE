import { AlertTriangle, CheckCircle2, Lightbulb, Search } from "lucide-react";
import { analysisFinding, incidents, measures } from "@/lib/seed-data";

export default function AwarenessSlidesPage({ params }: { params: { id: string } }) {
  const incident = incidents.find((item) => item.id === params.id) ?? incidents[0];
  const incidentMeasures = measures.filter((measure) => measure.incidentId === incident.id);

  const slides = [
    {
      title: "What happened?",
      icon: AlertTriangle,
      body: `${incident.title}. The event occurred on ${incident.incidentDate} at ${incident.location}.`,
      accent: "#E74C3C",
    },
    {
      title: "Why did it happen?",
      icon: Search,
      body: analysisFinding.rootCauses.join(" "),
      accent: "#F39C12",
    },
    {
      title: "What are we doing?",
      icon: CheckCircle2,
      body: incidentMeasures.map((measure) => measure.description).join(" "),
      accent: "#27AE60",
    },
    {
      title: "Lessons learned",
      icon: Lightbulb,
      body: "Verify temporary setups, challenge incomplete procedures, and stop work when controls are unclear.",
      accent: "#1B4F72",
    },
  ];

  return (
    <main className="bg-slate-950 text-white print:bg-white">
      {slides.map((slide, index) => {
        const Icon = slide.icon;
        return (
          <section key={slide.title} className="flex min-h-screen break-after-page flex-col justify-between p-8 md:p-14" style={{ borderTop: `14px solid ${slide.accent}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/60">SafeTrack awareness · Slide {index + 1}</p>
                <h1 className="mt-5 font-heading text-5xl font-bold">{slide.title}</h1>
              </div>
              <div className="flex h-20 w-20 items-center justify-center rounded-lg" style={{ backgroundColor: slide.accent }}>
                <Icon className="h-11 w-11" />
              </div>
            </div>
            <p className="max-w-5xl text-3xl font-semibold leading-tight md:text-5xl">{slide.body}</p>
            <div className="flex items-end justify-between border-t border-white/20 pt-6">
              <p className="font-heading text-2xl font-bold">{incident.referenceNumber}</p>
              <p className="text-right text-sm font-semibold text-white/60">Anonymise personal details before workforce sharing</p>
            </div>
          </section>
        );
      })}
    </main>
  );
}
