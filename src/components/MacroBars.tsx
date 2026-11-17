import type { TKey } from "@/lib/i18n/dictionaries";
import { grams, kcal, type Macros, type Target } from "@/lib/nutrition";

type T = (key: TKey) => string;

/** One measure against its target: value / target, what's left (or over), and a thin bar. */
function Bar({ label, value, target, unit, t, big = false }: { label: string; value: number; target: number | null; unit: string; t: T; big?: boolean }) {
  const show = big ? kcal : grams;
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const left = target != null ? target - value : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className={big ? "text-sm font-medium" : "text-sm"}>{label}</span>
        <span className="text-xs text-muted">
          {left == null ? null : left >= 0 ? (
            <>
              <span className="num text-text">{show(left)}</span> {unit} {t("n.left")}
            </>
          ) : (
            <>
              <span className="num text-text">{show(-left)}</span> {unit} {t("n.over")}
            </>
          )}
        </span>
      </div>
      <p className={big ? "mt-1 text-2xl font-semibold" : "mt-0.5 text-sm"}>
        <span className="num">{show(value)}</span>
        {target != null && (
          <span className="text-muted">
            {" "}
            / <span className="num">{show(target)}</span>
          </span>
        )}{" "}
        <span className="text-xs text-muted">{unit}</span>
      </p>
      {target != null && (
        <div className={`mt-1.5 overflow-hidden rounded-full bg-line ${big ? "h-2" : "h-1.5"}`} aria-hidden="true">
          {/* full = on target; never turns a warning colour, a coaching app should not alarm */}
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

/** Calories and each macro vs target, with remaining amounts (spec #9). */
export function MacroBars({ totals, target, t }: { totals: Macros; target: Target | null; t: T }) {
  return (
    <div className="space-y-4">
      <Bar big label={t("n.calories")} value={totals.calories} target={target?.calories ?? null} unit={t("n.kcal")} t={t} />
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Bar label={t("n.protein")} value={totals.protein_g} target={target?.protein_g ?? null} unit={t("n.g")} t={t} />
        <Bar label={t("n.carbs")} value={totals.carbs_g} target={target?.carbs_g ?? null} unit={t("n.g")} t={t} />
        <Bar label={t("n.fat")} value={totals.fat_g} target={target?.fat_g ?? null} unit={t("n.g")} t={t} />
        <Bar label={t("n.fiber")} value={totals.fiber_g} target={target?.fiber_g ?? null} unit={t("n.g")} t={t} />
      </div>
    </div>
  );
}
