import { NextResponse } from "next/server";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

const maxBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function POST(request: Request) {
  const companyId = await requireTenantCompanyId();
  const formData = await request.formData();
  const file = formData.get("file");
  const incidentId = String(formData.get("incidentId") ?? "draft");
  const category = String(formData.get("category") ?? "attachments");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > maxBytes) {
    return NextResponse.json({ error: "File exceeds 10MB limit" }, { status: 400 });
  }

  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${companyId}/${incidentId}/${category}/${crypto.randomUUID()}-${safeName}`;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ path, uploaded: false, demoMode: true });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from("incident-attachments").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path, uploaded: true });
}
