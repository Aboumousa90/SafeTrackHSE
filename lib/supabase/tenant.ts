import { cache } from "react";
import { redirect } from "next/navigation";
import { company as seedCompany, users as seedUsers } from "@/lib/seed-data";
import type { Company, TenantUser } from "@/lib/types";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";

interface UserRow {
  id: string;
  company_id: string | null;
  role: TenantUser["role"];
  full_name: string;
  email: string;
  department_id: string | null;
  language: TenantUser["language"];
  companies: {
    id: string;
    name: string;
    logo_url: string | null;
    industry: string | null;
    country: string | null;
    subscription_plan: Company["subscriptionPlan"];
  } | null;
}

export interface TenantContext {
  company: Company;
  user: TenantUser;
  isSeed: boolean;
}

export const getCurrentTenant = cache(async (): Promise<TenantContext> => {
  if (!isSupabaseConfigured()) {
    return { company: seedCompany, user: seedUsers[0], isSeed: true };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, company_id, role, full_name, email, department_id, language, companies(id, name, logo_url, industry, country, subscription_plan)")
    .eq("id", authUser.id)
    .single<UserRow>();

  if (error || !data || !data.company_id || !data.companies) {
    redirect("/login?error=tenant_profile_missing");
  }

  return {
    isSeed: false,
    company: {
      id: data.companies.id,
      name: data.companies.name,
      logoUrl: data.companies.logo_url ?? "",
      industry: data.companies.industry ?? "",
      country: data.companies.country ?? "",
      subscriptionPlan: data.companies.subscription_plan,
    },
    user: {
      id: data.id,
      companyId: data.company_id,
      role: data.role,
      fullName: data.full_name,
      email: data.email,
      departmentId: data.department_id ?? "",
      language: data.language,
    },
  };
});

export async function requireTenantCompanyId() {
  const tenant = await getCurrentTenant();
  return tenant.company.id;
}
