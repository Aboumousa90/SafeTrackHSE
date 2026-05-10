import { IncidentRegister } from "@/components/incidents/incident-register";
import { getDashboardData } from "@/lib/supabase/data";

export default async function IncidentsPage() {
  const { departments, incidents } = await getDashboardData();

  return <IncidentRegister departments={departments} incidents={incidents} />;
}
