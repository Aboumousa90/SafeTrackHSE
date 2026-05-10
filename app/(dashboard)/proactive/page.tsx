import { ProactiveWorkspace } from "@/components/proactive/proactive-workspace";
import { listDemoProactiveReports } from "@/lib/demo-store";
import { departments, proactiveReports, users } from "@/lib/seed-data";

export default function ProactivePage() {
  return (
    <ProactiveWorkspace
      departments={departments}
      users={users}
      initialReports={[...listDemoProactiveReports(), ...proactiveReports]}
    />
  );
}
