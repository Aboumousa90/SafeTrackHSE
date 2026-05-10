import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { getDemoCompany, getDemoCompanyConfig, listDemoDepartments, listDemoIncidents, listDemoUsers } from "@/lib/demo-store";
import { company, companyConfig, departments, users } from "@/lib/seed-data";

export default function SettingsPage() {
  const effectiveCompany = getDemoCompany() ?? company;
  const effectiveDepartments = [...listDemoDepartments(), ...departments];
  const effectiveUsers = [...listDemoUsers(), ...users];
  const effectiveConfig = getDemoCompanyConfig() ?? companyConfig;

  return (
    <SettingsWorkspace
      initialCompany={effectiveCompany}
      initialDepartments={effectiveDepartments}
      initialUsers={effectiveUsers}
      initialConfig={effectiveConfig}
      usage={{
        incidentsThisMonth: listDemoIncidents().length + 42,
        activeUsers: effectiveUsers.length,
        storageGb: 7.4,
      }}
    />
  );
}
