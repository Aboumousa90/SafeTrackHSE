import { NextResponse } from "next/server";
import { z } from "zod";
import { generateAiMeasureSuggestions } from "@/lib/ai/measures";
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
  incidentDescription: z.string().optional(),
  language: z.enum(["nl", "en", "fr"]).default("nl"),
  finding: findingSchema,
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid measure suggestion payload" }, { status: 400 });
  }

  await requireTenantCompanyId();

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const suggestions = await generateAiMeasureSuggestions({
        incidentId: parsed.data.incidentId,
        incidentDescription: parsed.data.incidentDescription,
        finding: parsed.data.finding,
        language: parsed.data.language,
      });
      addDemoSuggestedMeasures(suggestions);
      return NextResponse.json({ suggestions, aiGenerated: true });
    } catch {
      // Fall back to the template generator below so the workflow never blocks.
    }
  }

  const suggestions = generateMuopoSuggestions(parsed.data.incidentId, parsed.data.finding, parsed.data.language);
  addDemoSuggestedMeasures(suggestions);

  return NextResponse.json({ suggestions, aiGenerated: false });
}
