import { NextResponse } from "next/server";
import { getReleaseReadiness } from "@/lib/platform/readiness";

export async function GET() {
  return NextResponse.json(getReleaseReadiness());
}
