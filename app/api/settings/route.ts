import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoDepartment, addDemoUser, saveDemoCompany, saveDemoCompanyConfig } from "@/lib/demo-store";
import { companyConfig as seedCompanyConfig } from "@/lib/seed-data";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/supabase/tenant";
import type { Company, CompanyConfig, Department, TenantUser } from "@/lib/types";

const roleSchema = z.enum(["company_admin", "hse_manager", "supervisor", "employee"]);

const profileSchema = z.object({
  action: z.literal("profile"),
  name: z.string().min(2),
  industry: z.string().min(2),
  country: z.string().min(2),
  subscriptionPlan: z.enum(["Basic", "Professional", "Enterprise"]),
  logoUrl: z.string().nullable().optional(),
});

const departmentSchema = z.object({
  action: z.literal("department"),
  name: z.string().min(2),
  managerId: z.string().min(1),
});

const userSchema = z.object({
  action: z.literal("user"),
  fullName: z.string().min(2),
  email: z.string().email(),
  role: roleSchema,
  departmentId: z.string().min(1),
  language: z.enum(["nl", "en", "fr"]),
});

const severityCellSchema = z.object({
  likelihood: z.number().int().min(1).max(5),
  consequence: z.number().int().min(1).max(5),
  level: z.enum(["S1", "S2", "S3", "S4", "S5"]),
  label: z.string().min(1),
});

const pseRuleSchema = z.object({
  productClass: z.string().min(1),
  thresholdQuantity: z.number().positive(),
  unit: z.enum(["kg", "L", "m3"]),
  classification: z.string().min(1),
  consequenceArea: z.string().min(1),
});

const notificationSchema = z.object({
  newIncident: z.array(roleSchema),
  escalatedSeverity: z.array(roleSchema),
  overdueMeasure: z.array(roleSchema),
  monthlyAnalytics: z.array(roleSchema),
  proactiveHighRisk: z.array(roleSchema),
});

const configSchema = z.object({
  action: z.literal("config"),
  severityMatrix: z.array(severityCellSchema).length(25),
  corporatePseStandard: z.array(pseRuleSchema),
  notificationSettings: notificationSchema,
  reportTemplateUrl: z.string().nullable().optional(),
  slideTemplateUrl: z.string().nullable().optional(),
  footerText: z.string().min(1),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const settingsSchema = z.discriminatedUnion("action", [profileSchema, departmentSchema, userSchema, configSchema]);

export async function PATCH(request: Request) {
  const parsed = settingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  const tenant = await getCurrentTenant();

  if (!isSupabaseConfigured()) {
    if (parsed.data.action === "profile") {
      const company: Company = {
        ...tenant.company,
        name: parsed.data.name,
        industry: parsed.data.industry,
        country: parsed.data.country,
        subscriptionPlan: parsed.data.subscriptionPlan,
        logoUrl: parsed.data.logoUrl ?? "",
      };
      saveDemoCompany(company);
      return NextResponse.json({ company, demoMode: true });
    }

    if (parsed.data.action === "department") {
      const department: Department = {
        id: crypto.randomUUID(),
        companyId: tenant.company.id,
        name: parsed.data.name,
        managerId: parsed.data.managerId,
      };
      addDemoDepartment(department);
      return NextResponse.json({ department, demoMode: true });
    }

    if (parsed.data.action === "user") {
      const user: TenantUser = {
        id: crypto.randomUUID(),
        companyId: tenant.company.id,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        role: parsed.data.role,
        departmentId: parsed.data.departmentId,
        language: parsed.data.language,
      };
      addDemoUser(user);
      return NextResponse.json({ user, demoMode: true });
    }

    const config: CompanyConfig = {
      id: seedCompanyConfig.id,
      companyId: tenant.company.id,
      severityMatrix: parsed.data.severityMatrix,
      corporatePseStandard: parsed.data.corporatePseStandard,
      notificationSettings: parsed.data.notificationSettings,
      reportTemplateUrl: parsed.data.reportTemplateUrl ?? null,
      slideTemplateUrl: parsed.data.slideTemplateUrl ?? null,
      footerText: parsed.data.footerText,
      brandColor: parsed.data.brandColor,
    };
    saveDemoCompanyConfig(config);
    return NextResponse.json({ config, demoMode: true });
  }

  const supabase = createSupabaseServerClient();

  if (parsed.data.action === "profile") {
    const { error } = await supabase.from("companies").update({
      name: parsed.data.name,
      industry: parsed.data.industry,
      country: parsed.data.country,
      subscription_plan: parsed.data.subscriptionPlan,
      logo_url: parsed.data.logoUrl ?? null,
    }).eq("id", tenant.company.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ company: { ...tenant.company, ...parsed.data }, demoMode: false });
  }

  if (parsed.data.action === "department") {
    const { data, error } = await supabase.from("departments").insert({
      company_id: tenant.company.id,
      name: parsed.data.name,
      manager_id: parsed.data.managerId,
    }).select("id").single<{ id: string }>();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "Department insert failed" }, { status: 500 });
    return NextResponse.json({ department: { id: data.id, companyId: tenant.company.id, name: parsed.data.name, managerId: parsed.data.managerId }, demoMode: false });
  }

  if (parsed.data.action === "user") {
    const userId = crypto.randomUUID();
    const { error } = await supabase.from("users").insert({
      id: userId,
      company_id: tenant.company.id,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      role: parsed.data.role,
      department_id: parsed.data.departmentId,
      language: parsed.data.language,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: { id: userId, companyId: tenant.company.id, ...parsed.data }, demoMode: false });
  }

  const { error } = await supabase.from("company_configs").upsert({
    company_id: tenant.company.id,
    severity_matrix: parsed.data.severityMatrix,
    corporate_pse_standard: parsed.data.corporatePseStandard,
    notification_settings: parsed.data.notificationSettings,
    report_template_url: parsed.data.reportTemplateUrl ?? null,
    slide_template_url: parsed.data.slideTemplateUrl ?? null,
  }, { onConflict: "company_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: parsed.data, demoMode: false });
}
