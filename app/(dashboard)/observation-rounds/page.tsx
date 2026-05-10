import { ObservationRoundsWorkspace } from "@/components/observation-rounds/observation-rounds-workspace";
import { listDemoObservationRounds } from "@/lib/demo-store";
import { departments, observationRounds, users } from "@/lib/seed-data";

export default function ObservationRoundsPage() {
  return (
    <ObservationRoundsWorkspace
      departments={departments}
      users={users}
      initialRounds={[...listDemoObservationRounds(), ...observationRounds]}
    />
  );
}
