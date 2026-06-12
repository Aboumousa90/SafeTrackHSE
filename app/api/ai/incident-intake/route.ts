import { NextResponse } from "next/server";
import { analyzeIncidentPhoto, demoIntakeSuggestions, type IntakeImageMediaType } from "@/lib/ai/intake";
import { checkAiRateLimit } from "@/lib/ai/rate-limit";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";
import type { Locale } from "@/lib/types";

// Anthropic accepts images up to ~5MB; keep a safety margin for base64 overhead.
const maxImageBytes = 4.5 * 1024 * 1024;
const allowedImageTypes = new Set<IntakeImageMediaType>(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const note = String(formData.get("note") ?? "");
  const langValue = String(formData.get("language") ?? "nl");
  const language: Locale = langValue === "en" || langValue === "fr" ? langValue : "nl";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing photo" }, { status: 400 });
  }
  if (!allowedImageTypes.has(file.type as IntakeImageMediaType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > maxImageBytes) {
    return NextResponse.json({ error: "Photo exceeds the 4.5MB limit for AI analysis" }, { status: 400 });
  }

  const rate = await checkAiRateLimit(await resolveUserId());
  if (!rate.allowed) {
    return NextResponse.json({ error: "AI rate limit exceeded" }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ suggestion: demoIntakeSuggestions[language], demoMode: true });
  }

  await requireTenantCompanyId();

  const imageBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const suggestion = await analyzeIncidentPhoto({
    imageBase64,
    mediaType: file.type as IntakeImageMediaType,
    note,
    language,
  });

  return NextResponse.json({ suggestion });
}

async function resolveUserId() {
  if (!isSupabaseConfigured()) {
    return "demo-user";
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? "anonymous";
}
