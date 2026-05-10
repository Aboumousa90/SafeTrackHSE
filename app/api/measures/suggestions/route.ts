import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoSuggestedMeasures } from "@/lib/demo-store";
import { generateMuopoSuggestions } from "@/lib/measures/suggestions";
import { requireTenantCompanyId } from "@/lib/supabase/tenant";

const findingSchema = z.object({
  directCauses: z.array(z.string()),
  underlyingCauses: z.array(z.string()),
  rootCauses: z.array(z.string()),
  contributingFactors: z.array(z.string()),
});

const bodySchema = z.object({
  incidentId: z.string().min(1),
  language: z.enum(["nl", "en", "fr"]).default("nl"),
  finding: findingSchema,
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid measure suggestion payload" }, { status: 400 });
  }

  await requireTenantCompanyId();
  const suggestions = generateMuopoSuggestions(parsed.data.incidentId, parsed.data.finding, parsed.data.language);
  addDemoSuggestedMeasures(suggestions);

  return NextResponse.json({ suggestions });
}
