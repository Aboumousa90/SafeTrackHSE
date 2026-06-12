import { NextResponse } from "next/server";
import { enrichSnapshotWithAiInsights } from "@/lib/ai/insights";
import { analyticsSnapshotToCsv } from "@/lib/analytics/snapshot";
import { getDemoAnalyticsSnapshot } from "@/lib/analytics/data";
import type { Locale } from "@/lib/types";

function getPeriod(request: Request) {
  const url = new URL(request.url);
  const now = new Date();
  const year = Number(url.searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(url.searchParams.get("month") ?? now.getUTCMonth() + 1);

  return {
    year: Number.isInteger(year) ? year : now.getUTCFullYear(),
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getUTCMonth() + 1,
  };
}

export async function GET(request: Request) {
  const period = getPeriod(request);
  const url = new URL(request.url);
  const baseSnapshot = getDemoAnalyticsSnapshot(period.year, period.month);

  if (url.searchParams.get("format") === "csv") {
    return new Response(analyticsSnapshotToCsv(baseSnapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hse-snapshot-${period.year}-${String(period.month).padStart(2, "0")}.csv"`,
      },
    });
  }

  const langParam = url.searchParams.get("lang");
  const language: Locale = langParam === "nl" || langParam === "en" || langParam === "fr" ? langParam : "en";
  const snapshot = await enrichSnapshotWithAiInsights(baseSnapshot, language);

  return NextResponse.json({ snapshot, demoMode: !process.env.ANTHROPIC_API_KEY });
}
