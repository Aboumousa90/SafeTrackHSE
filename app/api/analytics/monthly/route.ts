import { NextResponse } from "next/server";
import { analyticsSnapshotToCsv } from "@/lib/analytics/snapshot";
import { getDemoAnalyticsSnapshot } from "@/lib/analytics/data";

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
  const snapshot = getDemoAnalyticsSnapshot(period.year, period.month);
  const url = new URL(request.url);

  if (url.searchParams.get("format") === "csv") {
    return new Response(analyticsSnapshotToCsv(snapshot), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="hse-snapshot-${period.year}-${String(period.month).padStart(2, "0")}.csv"`,
      },
    });
  }

  return NextResponse.json({ snapshot, demoMode: true });
}
