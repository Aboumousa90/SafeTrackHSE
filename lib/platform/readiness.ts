import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { ReleaseReadinessCheck, ReleaseReadinessSummary } from "@/lib/types";

function hasValue(name: string) {
  return Boolean(process.env[name] && process.env[name]?.trim());
}

export function getReleaseReadiness(): ReleaseReadinessSummary {
  const checks: ReleaseReadinessCheck[] = [
    {
      area: "environment",
      name: "Supabase connection",
      status: isSupabaseConfigured() ? "ready" : "needs_config",
      detail: isSupabaseConfigured() ? "Server/client Supabase variables are configured." : "The app is running in seed/demo mode without Supabase tenant data.",
      action: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    {
      area: "security",
      name: "Service role key",
      status: hasValue("SUPABASE_SERVICE_ROLE_KEY") ? "ready" : "needs_config",
      detail: hasValue("SUPABASE_SERVICE_ROLE_KEY") ? "Service role key is present for trusted server operations." : "Service role key is missing; admin-only background jobs should remain disabled.",
      action: "Set SUPABASE_SERVICE_ROLE_KEY only in server-side environments.",
    },
    {
      area: "ai",
      name: "Claude API",
      status: hasValue("ANTHROPIC_API_KEY") ? "ready" : "needs_config",
      detail: hasValue("ANTHROPIC_API_KEY") ? "AI analysis routes can call Claude." : "Root cause and analytics AI routes will use demo/fallback behavior.",
      action: "Set ANTHROPIC_API_KEY.",
    },
    {
      area: "notifications",
      name: "Email delivery",
      status: hasValue("RESEND_API_KEY") ? "ready" : "needs_config",
      detail: hasValue("RESEND_API_KEY") ? "Transactional email provider is configured." : "Email notifications are queued or skipped in demo mode.",
      action: "Set RESEND_API_KEY and verify the sending domain.",
    },
    {
      area: "notifications",
      name: "Browser push",
      status: hasValue("WEB_PUSH_PUBLIC_KEY") && hasValue("WEB_PUSH_PRIVATE_KEY") && hasValue("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") ? "ready" : "needs_config",
      detail: hasValue("WEB_PUSH_PUBLIC_KEY") && hasValue("WEB_PUSH_PRIVATE_KEY") && hasValue("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY") ? "VAPID keys are configured." : "Push subscription UI is present, but browser push cannot complete without VAPID keys.",
      action: "Generate VAPID keys and set WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, and NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY.",
    },
    {
      area: "data",
      name: "Tenant RLS migration",
      status: "ready",
      detail: "Schema includes company_id isolation policies, sensitive victim access rules, storage bucket policy, and push subscription RLS.",
      action: "Apply supabase/migrations/001_safetrack_schema.sql to the production project.",
    },
    {
      area: "pwa",
      name: "Offline app shell",
      status: "ready",
      detail: "PWA manifest, offline fallback, custom worker, and offline incident draft queue are implemented.",
      action: "Run a production deployment and verify service worker registration over HTTPS.",
    },
    {
      area: "reporting",
      name: "PDF/report export",
      status: "ready",
      detail: "Incident report PDF and awareness slides are available from the reports module.",
      action: "Upload branded report and slide templates in company settings.",
    },
  ];

  return {
    ready: checks.filter((check) => check.status === "ready").length,
    needsConfig: checks.filter((check) => check.status === "needs_config").length,
    blocked: checks.filter((check) => check.status === "blocked").length,
    checks,
  };
}
