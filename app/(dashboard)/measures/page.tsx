import { MeasuresBoard } from "@/components/measures/measures-board";
import { listDemoMeasures, listDemoSuggestedMeasures } from "@/lib/demo-store";
import { measures, users } from "@/lib/seed-data";

export default function MeasuresPage() {
  return (
    <MeasuresBoard
      initialMeasures={[...listDemoMeasures(), ...measures]}
      initialSuggestions={listDemoSuggestedMeasures()}
      users={users}
    />
  );
}
