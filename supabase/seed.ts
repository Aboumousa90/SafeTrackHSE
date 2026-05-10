import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  const { data: company, error } = await supabase
    .from("companies")
    .insert({ name: "SafeTrack Chemicals Belgium", industry: "Specialty chemicals", country: "BE", subscription_plan: "Enterprise" })
    .select()
    .single();

  if (error) throw error;

  await supabase.from("company_configs").insert({
    company_id: company.id,
    severity_matrix: { likelihood: [1, 2, 3, 4, 5], consequence: [1, 2, 3, 4, 5] },
    corporate_pse_standard: { tiers: ["Tier 1", "Tier 2", "Tier 3"] },
  });

  console.log(`Seeded company ${company.id}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
