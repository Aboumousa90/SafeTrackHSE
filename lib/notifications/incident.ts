import { Resend } from "resend";
import type { Incident, UserRole } from "@/lib/types";
import { incidentNotificationEmail } from "@/lib/email/templates";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

type NotificationChannel = "email" | "push";
type NotificationStatus = "queued" | "sent" | "skipped" | "failed";

interface NotificationRecord {
  companyId: string;
  incidentId: string;
  eventType: "incident_created" | "incident_escalated";
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  payload: Record<string, string | boolean | null>;
  error?: string;
}

const hseRecipientRoles: UserRole[] = ["hse_manager", "company_admin"];

export async function notifyIncidentCreated(incident: Incident) {
  const records: NotificationRecord[] = [];

  if (!isSupabaseConfigured()) {
    return {
      queued: true,
      sent: false,
      demoMode: true,
      recipients: ["hse.manager@safetrack.demo", "supervisor@safetrack.demo"],
    };
  }

  const supabase = createSupabaseServerClient();
  const { data: recipients, error } = await supabase
    .from("users")
    .select("email, role")
    .eq("company_id", incident.companyId)
    .in("role", incident.severityLevel === "S1" || incident.severityLevel === "S2" ? [...hseRecipientRoles, "supervisor"] : ["hse_manager", "supervisor"])
    .returns<Array<{ email: string; role: UserRole }>>();

  if (error) {
    await insertNotificationRecord({
      companyId: incident.companyId,
      incidentId: incident.id,
      eventType: "incident_created",
      channel: "email",
      status: "failed",
      recipient: "tenant",
      payload: { referenceNumber: incident.referenceNumber },
      error: error.message,
    });
    return { queued: false, sent: false, error: error.message };
  }

  const uniqueRecipients = Array.from(new Set((recipients ?? []).map((recipient) => recipient.email)));
  const email = incidentNotificationEmail(incident);
  const resendKey = process.env.RESEND_API_KEY;

  for (const recipient of uniqueRecipients) {
    if (!resendKey) {
      records.push({
        companyId: incident.companyId,
        incidentId: incident.id,
        eventType: incident.severityLevel === "S1" || incident.severityLevel === "S2" ? "incident_escalated" : "incident_created",
        channel: "email",
        status: "queued",
        recipient,
        payload: { referenceNumber: incident.referenceNumber, subject: email.subject },
      });
      continue;
    }

    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "SafeTrack <notifications@safetrack.example>",
        to: recipient,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      records.push({
        companyId: incident.companyId,
        incidentId: incident.id,
        eventType: "incident_created",
        channel: "email",
        status: "sent",
        recipient,
        payload: { referenceNumber: incident.referenceNumber, subject: email.subject },
      });
    } catch (error) {
      records.push({
        companyId: incident.companyId,
        incidentId: incident.id,
        eventType: "incident_created",
        channel: "email",
        status: "failed",
        recipient,
        payload: { referenceNumber: incident.referenceNumber, subject: email.subject },
        error: error instanceof Error ? error.message : "Unknown email error",
      });
    }
  }

  await Promise.all(records.map(insertNotificationRecord));

  return {
    queued: records.some((record) => record.status === "queued"),
    sent: records.some((record) => record.status === "sent"),
    recipients: uniqueRecipients,
  };
}

async function insertNotificationRecord(record: NotificationRecord) {
  if (!isSupabaseConfigured()) return;

  const supabase = createSupabaseServerClient();
  await supabase.from("notification_events").insert({
    company_id: record.companyId,
    incident_id: record.incidentId,
    event_type: record.eventType,
    channel: record.channel,
    status: record.status,
    recipient: record.recipient,
    payload: record.payload,
    error: record.error ?? null,
  });
}
