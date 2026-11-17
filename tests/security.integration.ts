// Database security + data-integrity suite. Runs against a LOCAL Supabase only.
//   npm run test:db
// Needs TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_KEY (from `npx supabase status -o env`).
// The service key is used only to create and remove the synthetic test users; every attack
// below runs with an ordinary signed-in (or signed-out) session, exactly like the app.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const URL_ = process.env.TEST_SUPABASE_URL ?? "";
const ANON = process.env.TEST_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.TEST_SUPABASE_SERVICE_KEY ?? "";
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_) || !ANON || !SERVICE) {
  console.error("Refusing to run: set TEST_SUPABASE_URL to a local Supabase (http://127.0.0.1:54321) plus both keys.");
  process.exit(2);
}

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail: unknown = "") {
  if (ok) pass++;
  else failures.push(`${name} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
  console.log(ok ? "PASS" : "FAIL", name, ok ? "" : detail);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SERVICE, opts);
const run = randomBytes(3).toString("hex");
const email = (who: string) => `${who}-${run}@example.test`;
const users: string[] = [];

async function makeUser(who: string, invite = true) {
  const password = randomBytes(12).toString("base64url");
  if (invite) await admin.from("client_invites").insert({ email: email(who) });
  const { data, error } = await admin.auth.admin.createUser({ email: email(who), password, email_confirm: true, user_metadata: { full_name: `${who} ${run}` } });
  if (error || !data.user) throw new Error(`could not create ${who}: ${error?.message}`);
  users.push(data.user.id);
  const client = createClient(URL_, ANON, opts);
  const { error: e2 } = await client.auth.signInWithPassword({ email: email(who), password });
  if (e2) throw new Error(`could not sign in ${who}: ${e2.message}`);
  return { id: data.user.id, db: client };
}

/** Runs a write and reports whether the database refused it (error) or silently matched nothing. */
async function blocked(q: PromiseLike<{ data: unknown; error: unknown; count?: number | null }>) {
  const { data, error } = await q;
  return Boolean(error) || (Array.isArray(data) && data.length === 0) || data === null;
}

async function main() {
  // make sure a coach exists, so the invitation rule is active
  const coach = await makeUser("coach");
  await admin.from("profiles").update({ role: "coach" }).eq("id", coach.id);
  const A = await makeUser("client-a");
  const B = await makeUser("client-b");
  const anon = createClient(URL_, ANON, opts);
  const today = new Date().toISOString().slice(0, 10);

  // ───── seed Client B's data with the service key ─────
  const { data: ex } = await admin.from("exercises").select("id").eq("is_global", true).limit(1).single();
  const { data: food } = await admin.from("foods").select("id").eq("is_global", true).limit(1).single();
  const { data: bWorkout } = await admin.from("workouts").insert({ user_id: B.id, title: "B secret workout", ended_at: new Date().toISOString() }).select("id").single();
  const { data: bWe } = await admin.from("workout_exercises").insert({ workout_id: bWorkout!.id, user_id: B.id, exercise_id: ex!.id, position: 0 }).select("id").single();
  await admin.from("workout_sets").insert({ workout_exercise_id: bWe!.id, user_id: B.id, position: 0, weight_kg: 100, reps: 5, completed_at: new Date().toISOString() });
  await admin.from("daily_checkins").insert({ user_id: B.id, check_date: today, weight_kg: 90, notes: "B private note" });
  await admin.from("weekly_checkins").insert({ user_id: B.id, week_start: today, waist_cm: 95 });
  await admin.from("food_logs").insert({ user_id: B.id, log_date: today, meal: "lunch", name: "B food", calories: 500 });
  await admin.from("water_logs").insert({ user_id: B.id, log_date: today, ml: 500 });
  await admin.from("nutrition_targets").insert({ client_id: B.id, phase: "cut", calories: 2000, protein_g: 150, carbs_g: 200, fat_g: 60 });
  const { data: bPlan } = await admin.from("meal_plans").insert({ client_id: B.id, title: "B plan" }).select("id").single();
  await admin.from("subscriptions").insert({ client_id: B.id, plan_months: 1, price_omr: 25, start_date: today, end_date: today });
  await admin.from("coach_notes").insert({ client_id: B.id, body: "private coach note about B" });
  await admin.from("weekly_feedback").insert({ client_id: B.id, week_start: today, body: "feedback for B" });
  await admin.from("testimonials").insert({ client_id: B.id, title: "B win" });
  const { data: bRoutine } = await admin.from("routines").insert({ owner_id: B.id, title: "B routine" }).select("id").single();
  const { data: bFood } = await admin.from("foods").insert({ name_ar: "خاص", name_en: "B private food", kcal_100g: 100, created_by: B.id }).select("id").single();
  const { data: challenge } = await admin.from("challenges").insert({ title: "B-only challenge", start_date: today, end_date: today }).select("id").single();
  await admin.from("challenge_members").insert({ challenge_id: challenge!.id, client_id: B.id });
  await admin.from("publication_consents").insert({ client_id: B.id, scope: "results", wording_version: "v1", wording: "x", locale: "ar" });

  // ───── Client A tries to READ Client B's rows ─────
  const readable: [string, string, string][] = [
    ["profiles", "id", B.id], ["clients", "user_id", B.id], ["workouts", "user_id", B.id], ["workout_exercises", "user_id", B.id],
    ["workout_sets", "user_id", B.id], ["daily_checkins", "user_id", B.id], ["weekly_checkins", "user_id", B.id],
    ["food_logs", "user_id", B.id], ["water_logs", "user_id", B.id], ["nutrition_targets", "client_id", B.id],
    ["meal_plans", "client_id", B.id], ["subscriptions", "client_id", B.id], ["coach_notes", "client_id", B.id],
    ["weekly_feedback", "client_id", B.id], ["testimonials", "client_id", B.id], ["routines", "owner_id", B.id],
    ["challenge_members", "client_id", B.id], ["publication_consents", "client_id", B.id], ["v_set_stats", "user_id", B.id],
    ["v_daily_nutrition", "user_id", B.id], ["v_personal_records", "user_id", B.id],
  ];
  for (const [table, col, id] of readable) {
    const { data, error } = await A.db.from(table).select("*").eq(col, id);
    check(`A cannot read B's ${table}`, !error ? (data ?? []).length === 0 : true, data);
  }
  check("A cannot read B's private food", ((await A.db.from("foods").select("id").eq("id", bFood!.id)).data ?? []).length === 0);
  check("A cannot see a challenge they are not in", ((await A.db.from("challenges").select("id").eq("id", challenge!.id)).data ?? []).length === 0);
  check("A cannot read the invite list", ((await A.db.from("client_invites").select("email")).data ?? []).length === 0);
  const lb = await A.db.rpc("challenge_leaderboard", { p_challenge: challenge!.id });
  check("A cannot open B's challenge leaderboard", Boolean(lb.error));

  // ───── Client A tries to WRITE as / over Client B ─────
  check("A cannot log a workout as B", await blocked(A.db.from("workouts").insert({ user_id: B.id, title: "x" }).select()));
  check("A cannot attach an exercise to B's workout", await blocked(A.db.from("workout_exercises").insert({ workout_id: bWorkout!.id, user_id: A.id, exercise_id: ex!.id, position: 9 }).select()));
  check("A cannot add a set to B's workout", await blocked(A.db.from("workout_sets").insert({ workout_exercise_id: bWe!.id, user_id: A.id, position: 9 }).select()));
  check("A cannot edit B's sets", await blocked(A.db.from("workout_sets").update({ reps: 99 }).eq("user_id", B.id).select()));
  check("A cannot delete B's workout", await blocked(A.db.from("workouts").delete().eq("id", bWorkout!.id).select()));
  check("A cannot write B's check-in", await blocked(A.db.from("daily_checkins").insert({ user_id: B.id, check_date: "2026-01-01", weight_kg: 1 }).select()));
  check("A cannot edit B's check-in", await blocked(A.db.from("daily_checkins").update({ weight_kg: 1 }).eq("user_id", B.id).select()));
  check("A cannot log food for B", await blocked(A.db.from("food_logs").insert({ user_id: B.id, meal: "lunch", name: "x" }).select()));
  check("A cannot delete B's food log", await blocked(A.db.from("food_logs").delete().eq("user_id", B.id).select()));
  check("A cannot set nutrition targets (even own)", await blocked(A.db.from("nutrition_targets").insert({ client_id: A.id, phase: "bulk", calories: 9999, protein_g: 1, carbs_g: 1, fat_g: 1 }).select()));
  check("A cannot mark a subscription paid", await blocked(A.db.from("subscriptions").update({ payment_status: "paid" }).eq("client_id", B.id).select()));
  check("A cannot create a subscription", await blocked(A.db.from("subscriptions").insert({ client_id: A.id, plan_months: 6, price_omr: 0, start_date: today, end_date: today }).select()));
  check("A cannot write coach notes", await blocked(A.db.from("coach_notes").insert({ client_id: A.id, body: "x" }).select()));
  check("A cannot write feedback", await blocked(A.db.from("weekly_feedback").insert({ client_id: A.id, week_start: "2026-01-04", body: "x" }).select()));
  check("A cannot edit B's routine", await blocked(A.db.from("routines").update({ title: "hacked" }).eq("id", bRoutine!.id).select()));
  check("A cannot join a challenge", await blocked(A.db.from("challenge_members").insert({ challenge_id: challenge!.id, client_id: A.id }).select()));
  check("A cannot create a global food", await blocked(A.db.from("foods").insert({ name_ar: "x", name_en: "x", kcal_100g: 1, is_global: true, created_by: A.id }).select()));
  check("A cannot edit a global food", await blocked(A.db.from("foods").update({ kcal_100g: 1 }).eq("id", food!.id).select()));
  check("A cannot invite people", await blocked(A.db.from("client_invites").insert({ email: "friend@example.test" }).select()));
  check("A cannot give consent on B's behalf", await blocked(A.db.from("publication_consents").insert({ client_id: B.id, scope: "photos", wording_version: "v1", wording: "x", locale: "ar" }).select()));
  check("A cannot edit B's meal plan", await blocked(A.db.from("meal_plans").update({ title: "x" }).eq("id", bPlan!.id).select()));
  check("A cannot edit B's profile", await blocked(A.db.from("clients").update({ injuries: "x" }).eq("user_id", B.id).select()));

  // ───── role escalation ─────
  const esc = await A.db.from("profiles").update({ role: "coach" }).eq("id", A.id).select();
  check("A cannot make themselves coach", Boolean(esc.error), esc.data);
  const { data: aRole } = await admin.from("profiles").select("role").eq("id", A.id).single();
  check("A is still a client afterwards", aRole?.role === "client", aRole);
  check("A can still change their own unit", !(await A.db.from("profiles").update({ unit: "lb" }).eq("id", A.id)).error);
  const fbEdit = await B.db.from("weekly_feedback").update({ body: "I rewrote the coach's feedback" }).eq("client_id", B.id).select();
  check("B cannot rewrite coach feedback", Boolean(fbEdit.error), fbEdit.data);
  check("B can mark feedback read", !(await B.db.from("weekly_feedback").update({ read_at: new Date().toISOString() }).eq("client_id", B.id)).error);

  // ───── signed-out visitor ─────
  for (const table of ["profiles", "workouts", "daily_checkins", "food_logs", "coach_notes", "subscriptions", "publication_consents", "client_invites"]) {
    const { data, error } = await anon.from(table).select("*").limit(1);
    check(`signed-out visitor cannot read ${table}`, Boolean(error) || (data ?? []).length === 0, data);
  }

  // ───── invitation-only sign-up ─────
  const stranger = await anon.auth.signUp({ email: email("stranger"), password: randomBytes(12).toString("base64url") });
  check("uninvited email cannot sign up", Boolean(stranger.error), stranger.data.user?.id);
  if (stranger.data.user) users.push(stranger.data.user.id);
  await admin.from("client_invites").insert({ email: email("invited") });
  const invited = await anon.auth.signUp({ email: email("invited"), password: randomBytes(12).toString("base64url") });
  check("invited email can sign up", !invited.error && Boolean(invited.data.user), invited.error?.message);
  if (invited.data.user) users.push(invited.data.user.id);
  const upper = email("CaseTest");
  await admin.from("client_invites").insert({ email: upper.toLowerCase() });
  const mixed = await anon.auth.signUp({ email: upper, password: randomBytes(12).toString("base64url") });
  check("invite matching ignores letter case", !mixed.error, mixed.error?.message);
  if (mixed.data.user) users.push(mixed.data.user.id);

  // ───── progress photos ─────
  const jpeg = Buffer.from("ffd8ffe000104a46494600010100000100010000ffd9", "hex");
  const week = "2026-11-15";
  const bPath = `${B.id}/${week}/front.jpg`;
  const up = await B.db.storage.from("progress-photos").upload(bPath, jpeg, { contentType: "image/jpeg", upsert: true });
  check("B can upload own photo", !up.error, up.error?.message);
  check("A cannot download B's photo", Boolean((await A.db.storage.from("progress-photos").download(bPath)).error));
  check("A cannot sign a link to B's photo", Boolean((await A.db.storage.from("progress-photos").createSignedUrl(bPath, 60)).error));
  check("A cannot overwrite B's photo", Boolean((await A.db.storage.from("progress-photos").upload(bPath, jpeg, { contentType: "image/jpeg", upsert: true })).error));
  const del = await A.db.storage.from("progress-photos").remove([bPath]);
  check("A cannot delete B's photo", (del.data ?? []).length === 0, del.data);
  check("signed-out visitor cannot download it", Boolean((await anon.storage.from("progress-photos").download(bPath)).error));
  const pub = await fetch(`${URL_}/storage/v1/object/public/progress-photos/${bPath}`);
  check("no public link exists for it", pub.status >= 400, pub.status);
  check("coach can view it", !(await coach.db.storage.from("progress-photos").download(bPath)).error);
  check("coach cannot replace it", Boolean((await coach.db.storage.from("progress-photos").upload(bPath, jpeg, { contentType: "image/jpeg", upsert: true })).error));
  const signed = await coach.db.storage.from("progress-photos").createSignedUrl(bPath, 600);
  check("coach link opens", signed.data ? (await fetch(signed.data.signedUrl)).ok : false);
  check("B cannot upload a non-JPEG", Boolean((await B.db.storage.from("progress-photos").upload(`${B.id}/${week}/side.jpg`, Buffer.from("<html>"), { contentType: "text/html", upsert: true })).error));
  check("B cannot upload outside the photo layout", Boolean((await B.db.storage.from("progress-photos").upload(`${B.id}/anything.jpg`, jpeg, { contentType: "image/jpeg" })).error));
  const big = Buffer.alloc(6 * 1024 * 1024, 1);
  big[0] = 0xff; big[1] = 0xd8;
  check("B cannot upload a file over 5 MB", Boolean((await B.db.storage.from("progress-photos").upload(`${B.id}/${week}/back.jpg`, big, { contentType: "image/jpeg", upsert: true })).error));
  check("B can delete own photo", ((await B.db.storage.from("progress-photos").remove([bPath])).data ?? []).length === 1);

  // ───── duplicates from repeated taps / retries ─────
  const w1 = await A.db.from("workouts").insert({ user_id: A.id, title: "live 1" }).select("id").single();
  const w2 = await A.db.from("workouts").insert({ user_id: A.id, title: "live 2" }).select("id").single();
  check("only one unfinished workout per person", !w1.error && Boolean(w2.error) && (w2.error as { code?: string }).code === "23505", w2.error);
  const we = await A.db.from("workout_exercises").insert({ workout_id: w1.data!.id, user_id: A.id, exercise_id: ex!.id, position: 0 }).select("id").single();
  const s1 = await A.db.from("workout_sets").insert({ workout_exercise_id: we.data!.id, user_id: A.id, position: 0 });
  const s2 = await A.db.from("workout_sets").insert({ workout_exercise_id: we.data!.id, user_id: A.id, position: 0 });
  check("a double-tapped 'add set' cannot create two sets in one slot", !s1.error && Boolean(s2.error));
  const d1 = await A.db.from("daily_checkins").upsert({ user_id: A.id, check_date: today, weight_kg: 80 }, { onConflict: "user_id,check_date" });
  const d2 = await A.db.from("daily_checkins").upsert({ user_id: A.id, check_date: today, weight_kg: 80.4 }, { onConflict: "user_id,check_date" });
  const { data: aDaily } = await A.db.from("daily_checkins").select("weight_kg").eq("user_id", A.id);
  check("saving a check-in twice keeps one row with the latest value", !d1.error && !d2.error && aDaily?.length === 1 && Number(aDaily[0].weight_kg) === 80.4, aDaily);
  check("a 0 is stored as 0, not empty", !(await A.db.from("daily_checkins").update({ steps: 0 }).eq("user_id", A.id)).error &&
    (await A.db.from("daily_checkins").select("steps").eq("user_id", A.id).single()).data?.steps === 0);

  // ───── history is preserved ─────
  const { data: r } = await coach.db.from("routines").insert({ owner_id: coach.id, title: "temp routine" }).select("id").single();
  const { data: wr } = await admin.from("workouts").insert({ user_id: A.id, routine_id: r!.id, title: "from routine", ended_at: new Date().toISOString() }).select("id").single();
  await coach.db.from("routines").delete().eq("id", r!.id);
  const { data: kept } = await A.db.from("workouts").select("title, routine_id").eq("id", wr!.id).single();
  check("deleting a routine keeps past workouts", kept?.title === "from routine" && kept.routine_id === null, kept);
  const { data: tmpFood } = await coach.db.from("foods").insert({ name_ar: "مؤقت", name_en: "temp", kcal_100g: 200, protein_100g: 10, is_global: true }).select("id").single();
  const { data: log } = await A.db.from("food_logs").insert({ user_id: A.id, log_date: today, meal: "dinner", food_id: tmpFood!.id, name: "temp", grams: 150, calories: 300, protein_g: 15 }).select("id").single();
  await coach.db.from("foods").update({ kcal_100g: 999 }).eq("id", tmpFood!.id);
  await coach.db.from("foods").delete().eq("id", tmpFood!.id);
  const { data: logAfter } = await A.db.from("food_logs").select("name, calories, protein_g, food_id").eq("id", log!.id).single();
  check("editing then deleting a food keeps the logged entry and its numbers", logAfter?.name === "temp" && Number(logAfter.calories) === 300 && Number(logAfter.protein_g) === 15 && logAfter.food_id === null, logAfter);
  await coach.db.from("nutrition_targets").insert({ client_id: A.id, phase: "maintain", calories: 2500, protein_g: 150, carbs_g: 250, fat_g: 80, effective_from: "2026-10-01" });
  await coach.db.from("nutrition_targets").insert({ client_id: A.id, phase: "cut", calories: 2000, protein_g: 160, carbs_g: 180, fat_g: 65, effective_from: "2026-11-01" });
  const { data: tgts } = await A.db.from("nutrition_targets").select("phase").eq("client_id", A.id).order("effective_from");
  check("changing phase keeps the target history", tgts?.map((t) => t.phase).join() === "maintain,cut", tgts);

  // ───── publication consent ─────
  const give = await A.db.from("publication_consents").insert({ client_id: A.id, scope: "photos", wording_version: "v1", wording: "I agree", locale: "en" }).select("id").single();
  check("client can give consent", !give.error, give.error);
  check("coach cannot give consent for a client", await blocked(coach.db.from("publication_consents").insert({ client_id: A.id, scope: "quote", wording_version: "v1", wording: "x", locale: "en" }).select()));
  check("coach cannot withdraw for a client", await blocked(coach.db.from("publication_consents").update({ withdrawn_at: new Date().toISOString() }).eq("id", give.data!.id).select()));
  check("client cannot change the agreed wording", Boolean((await A.db.from("publication_consents").update({ wording: "something else", withdrawn_at: new Date().toISOString() }).eq("id", give.data!.id)).error));
  check("client can withdraw", !(await A.db.from("publication_consents").update({ withdrawn_at: new Date().toISOString() }).eq("id", give.data!.id)).error);
  check("a withdrawal cannot be undone (give again instead)", Boolean((await A.db.from("publication_consents").update({ withdrawn_at: null }).eq("id", give.data!.id)).error));
  check("client can give the same consent again", !(await A.db.from("publication_consents").insert({ client_id: A.id, scope: "photos", wording_version: "v1", wording: "I agree", locale: "en" })).error);
  check("only one active consent per scope", Boolean((await A.db.from("publication_consents").insert({ client_id: A.id, scope: "photos", wording_version: "v1", wording: "I agree", locale: "en" })).error));

  // ───── coach access sanity ─────
  check("coach sees both clients' workouts", ((await coach.db.from("workouts").select("id").in("user_id", [A.id, B.id])).data ?? []).length >= 2);
  check("coach sees private notes", ((await coach.db.from("coach_notes").select("id").eq("client_id", B.id)).data ?? []).length === 1);
}

main()
  .catch((e) => {
    failures.push(`crashed: ${e instanceof Error ? e.message : e}`);
    console.error(e);
  })
  .finally(async () => {
    // remove every synthetic user (their rows go with them) and leftover rows
    for (const id of users) await admin.auth.admin.deleteUser(id);
    await admin.from("client_invites").delete().like("email", `%-${run}@example.test`);
    await admin.from("challenges").delete().eq("title", "B-only challenge");
    console.log(`\n${pass}/${pass + failures.length} passed`);
    if (failures.length) {
      console.log("Failures:\n- " + failures.join("\n- "));
      process.exit(1);
    }
  });

