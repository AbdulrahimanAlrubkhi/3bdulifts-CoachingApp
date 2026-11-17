import { fmt, toDisplay, type Unit } from "@/lib/units";
import { Card } from "./ui";

export type RoutineViewItem = {
  name: string;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight_kg: number | null;
  rest_seconds: number;
};

/** "3 × 8–12 · 60 kg" */
export function targetText(item: Omit<RoutineViewItem, "name" | "rest_seconds">, unit: Unit) {
  const { target_reps_min: min, target_reps_max: max } = item;
  const reps = min && max && min !== max ? `${min}–${max}` : (min ?? max);
  let text = reps ? `${item.target_sets} × ${reps}` : `${item.target_sets} ×`;
  if (item.target_weight_kg != null) text += ` · ${fmt(toDisplay(item.target_weight_kg, unit))} ${unit}`;
  return text;
}

/** Read-only routine: used for coach-assigned routines and public share links. */
export function RoutineView({ items, unit }: { items: RoutineViewItem[]; unit: Unit }) {
  return (
    <Card className="py-1">
      <ol>
        {items.map((item, index) => (
          <li key={index} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-b-0">
            <span className="text-[15px]">{item.name}</span>
            <span className="num shrink-0 text-sm text-muted">{targetText(item, unit)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
