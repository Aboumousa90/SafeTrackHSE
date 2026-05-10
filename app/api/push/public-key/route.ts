import { NextResponse } from "next/server";
import { getPublicVapidKey } from "@/lib/push/web-push";

export async function GET() {
  return NextResponse.json({ publicKey: getPublicVapidKey(), configured: Boolean(getPublicVapidKey()) });
}
