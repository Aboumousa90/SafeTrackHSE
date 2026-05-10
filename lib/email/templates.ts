import type { Incident, Measure } from "@/lib/types";

export function incidentNotificationEmail(incident: Incident) {
  const severityLine = incident.isPse ? `${incident.severityLevel} · PSE flagged` : incident.severityLevel;

  return {
    subject: `[${incident.severityLevel}] ${incident.referenceNumber} - ${incident.title}`,
    html: `
      <main style="font-family:Arial,sans-serif;color:#17202A">
        <h1 style="color:#1B4F72">${incident.referenceNumber}</h1>
        <p><strong>${incident.title}</strong></p>
        <p>${incident.description}</p>
        <table style="border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:6px 12px;border:1px solid #E5E7EB">Severity</td><td style="padding:6px 12px;border:1px solid #E5E7EB">${severityLine}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #E5E7EB">Date</td><td style="padding:6px 12px;border:1px solid #E5E7EB">${incident.incidentDate} ${incident.incidentTime}</td></tr>
          <tr><td style="padding:6px 12px;border:1px solid #E5E7EB">Location</td><td style="padding:6px 12px;border:1px solid #E5E7EB">${incident.location} · ${incident.locationDetail}</td></tr>
        </table>
      </main>
    `,
    text: `${incident.referenceNumber}\n${incident.title}\n${severityLine}\n${incident.description}`,
  };
}

export function overdueMeasureEmail(measure: Measure) {
  return {
    subject: `Overdue HSE measure ${measure.id}`,
    html: `<p>${measure.description}</p><p>Due date: ${measure.dueDate}</p>`,
  };
}
