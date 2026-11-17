import Link from "next/link";
import type { TKey } from "@/lib/i18n/dictionaries";
import { Card } from "./ui";

export type LeaderRow = { client_id: string; display_name: string; weight_change_pct: number | null; consistency_pct: number | null };

/**
 * Challenge leaderboard (spec #19), ranked by weight change (most lost first) or by consistency.
 * Shows only what the database function returns: name, % change, % consistency.
 */
export function Leaderboard({
  rows,
  sort,
  baseHref,
  meId,
  t,
}: {
  rows: LeaderRow[];
  sort: "weight" | "consistency";
  baseHref: string;
  meId?: string;
  t: (key: TKey) => string;
}) {
  const sorted = [...rows].sort((a, b) =>
    sort === "weight"
      ? (a.weight_change_pct ?? Infinity) - (b.weight_change_pct ?? Infinity)
      : (b.consistency_pct ?? -1) - (a.consistency_pct ?? -1) || (a.weight_change_pct ?? Infinity) - (b.weight_change_pct ?? Infinity),
  );
  const tab = (key: "weight" | "consistency", label: string) => (
    <Link
      href={key === "consistency" ? baseHref : `${baseHref}?sort=weight`}
      aria-current={sort === key ? "page" : undefined}
      className={`flex-1 rounded-md py-2 text-center text-sm ${sort === key ? "border border-line bg-surface text-text" : "text-muted"}`}
    >
      {label}
    </Link>
  );
  const pct = (v: number | null, signed: boolean) =>
    v == null ? "–" : `${signed && v > 0 ? "+" : signed && v < 0 ? "−" : ""}${Math.abs(Number(v))}%`;

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-lg bg-bg p-1">
        {tab("consistency", t("ch.byConsistency"))}
        {tab("weight", t("ch.byWeight"))}
      </div>
      <Card className="py-1">
        {!sorted.length ? (
          <p className="py-3 text-sm text-muted">{t("ch.noMembers")}</p>
        ) : (
          <ol>
            {sorted.map((r, i) => (
              <li
                key={r.client_id}
                className={`flex items-center gap-3 border-b border-line py-2.5 text-sm last:border-b-0 ${r.client_id === meId ? "font-medium" : ""}`}
              >
                <span className="num w-5 text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  {r.display_name || "—"}
                  {r.client_id === meId && <span className="ms-1 text-xs text-accent">({t("ch.you")})</span>}
                </span>
                <span className={`num w-16 text-end ${sort === "weight" ? "" : "text-muted"}`}>{pct(r.weight_change_pct, true)}</span>
                <span className={`num w-12 text-end ${sort === "consistency" ? "" : "text-muted"}`}>{pct(r.consistency_pct, false)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <div className="mt-1 flex justify-end gap-3 px-1 text-[11px] text-muted">
        <span className="w-16 text-end">{t("ch.weightChange")}</span>
        <span className="w-12 text-end">{t("ch.consistency")}</span>
      </div>
      <p className="mt-2 text-xs text-muted">{t("ch.consistencyHint")}</p>
      {sort === "weight" && <p className="mt-1 text-xs text-muted">{t("ch.weightHint")}</p>}
    </div>
  );
}

export function challengeState(c: { start_date: string; end_date: string }, today: string): "ch.upcoming" | "ch.running" | "ch.finished" {
  return today < c.start_date ? "ch.upcoming" : today > c.end_date ? "ch.finished" : "ch.running";
}
