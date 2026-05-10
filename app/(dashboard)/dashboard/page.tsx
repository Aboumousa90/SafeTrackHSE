import { DashboardOverview } from "@/components/dashboard/overview";
import { getDashboardData } from "@/lib/supabase/data";

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardOverview {...data} />;
}
