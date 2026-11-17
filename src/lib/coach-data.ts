import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clientMetrics, type ClientMetrics } from "./coach-metrics";
import { addDays, dateInAppTz, todayISO } from "./dates";
import { TARGET_COLUMNS, type Target } from "./nutrition";

/** Reads every row of a query, a page at a time (the API returns at most 1,000 rows per request). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function all<T>(build: () => any): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data } = await build().range(from, from + size - 1);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}

type ClientBasics = { id: string; full_name: string; created_at: string; start_date: string | null; training_days_per_week: number | null; onboarded: boolean; archived: boolean; email: string | null };

/**
 * Dashboard numbers for the given clients (or every client), from three weeks of data.
 * Runs as the coach, so row-level security lets it see every client.
 */
export async function loadClientMetrics(
  supabase: SupabaseClient,
  onlyClientId?: string,
): Promise<{ clients: ClientBasics[]; metrics: Map<string, ClientMetrics> }> {
  const today = todayISO();
  const from21 = addDays(today, -20);

  let clientQuery = supabase
    .from("profiles")
    .select("id, full_name, created_at, clients(start_date, training_days_per_week, onboarded_at, archived, email)")
    .eq("role", "client")
    .order("full_name");
  if (onlyClientId) clientQuery = clientQuery.eq("id", onlyClientId);
  const { data: rows } = await clientQuery;
  type ClientCols = { start_date: string | null; training_days_per_week: number | null; onboarded_at: string | null; archived: boolean; email: string | null };
  type Row = { id: string; full_name: string; created_at: string; clients: ClientCols | ClientCols[] | null };
  const clients: ClientBasics[] = ((rows ?? []) as Row[]).map((r) => {
    const c = Array.isArray(r.clients) ? r.clients[0] : r.clients;
    return {
      id: r.id,
      full_name: r.full_name,
      created_at: r.created_at,
      start_date: c?.start_date ?? null,
      training_days_per_week: c?.training_days_per_week ?? null,
      onboarded: Boolean(c?.onboarded_at),
      archived: Boolean(c?.archived),
      email: c?.email ?? null,
    };
  });
  const ids = clients.map((c) => c.id);
  if (!ids.length) return { clients, metrics: new Map() };

  const [checkins, workouts, nutrition, targets] = await Promise.all([
    all<{ user_id: string; check_date: string; weight_kg: number | null }>(() =>
      supabase.from("daily_checkins").select("user_id, check_date, weight_kg").in("user_id", ids).gte("check_date", from21).order("check_date"),
    ),
    all<{ user_id: string; started_at: string }>(() =>
      supabase
        .from("workouts")
        .select("user_id, started_at")
        .in("user_id", ids)
        .not("ended_at", "is", null)
        .gte("started_at", `${addDays(today, -15)}T00:00:00Z`)
        .order("started_at"),
    ),
    all<{ user_id: string; log_date: string; calories: number; protein_g: number }>(() =>
      supabase.from("v_daily_nutrition").select("user_id, log_date, calories, protein_g").in("user_id", ids).gte("log_date", addDays(today, -8)).order("log_date"),
    ),
    all<Target & { client_id: string }>(() =>
      supabase.from("nutrition_targets").select(`client_id, ${TARGET_COLUMNS}`).in("client_id", ids).order("effective_from"),
    ),
  ]);

  const metrics = new Map<string, ClientMetrics>();
  for (const c of clients) {
    const mine = checkins.filter((r) => r.user_id === c.id);
    metrics.set(
      c.id,
      clientMetrics({
        today,
        startDate: c.start_date ?? dateInAppTz(c.created_at),
        trainingDays: c.training_days_per_week,
        weighIns: mine.filter((r) => r.weight_kg != null).map((r) => ({ date: r.check_date, kg: Number(r.weight_kg) })),
        checkinDates: mine.map((r) => r.check_date),
        workoutDates: workouts.filter((w) => w.user_id === c.id).map((w) => dateInAppTz(w.started_at)),
        nutritionDays: nutrition
          .filter((n) => n.user_id === c.id)
          .map((n) => ({ date: n.log_date, calories: Number(n.calories), protein_g: Number(n.protein_g) })),
        targets: targets.filter((t) => t.client_id === c.id),
      }),
    );
  }
  return { clients, metrics };
}
