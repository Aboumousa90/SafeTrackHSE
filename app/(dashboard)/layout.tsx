import { AppShell } from "@/components/layout/app-shell";
import { getCurrentTenant } from "@/lib/supabase/tenant";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  return <AppShell company={tenant.company} user={tenant.user}>{children}</AppShell>;
}
