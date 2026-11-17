import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Leaderboard, challengeState, type LeaderRow } from "@/components/Leaderboard";
import { Card, Field, PageTitle, ghostButtonClass, inputClass } from "@/components/ui";
import { deleteChallenge, saveChallenge, saveChallengeMembers } from "../../actions";

export default async function ChallengePage({ params, searchParams }: PageProps<"/coach/business/challenges/[id]">) {
  const { id } = await params;
  // consistency first: it rewards showing up and suits every goal; weight change is optional
  const sort = (await searchParams).sort === "weight" ? "weight" : "consistency";
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();

  const [{ data: challenge }, { data: members }, { data: clients }, { data: board }] = await Promise.all([
    supabase.from("challenges").select("id, title, description, start_date, end_date").eq("id", id).maybeSingle(),
    supabase.from("challenge_members").select("client_id").eq("challenge_id", id),
    supabase.from("profiles").select("id, full_name").eq("role", "client").order("full_name"),
    supabase.rpc("challenge_leaderboard", { p_challenge: id }),
  ]);
  if (!challenge) notFound();
  const memberIds = new Set((members ?? []).map((m) => m.client_id));
  const fmt = (d: string) => formatDay(d, locale, { day: "numeric", month: "short", year: "numeric" });

  return (
    <>
      <PageTitle>{challenge.title}</PageTitle>
      <p className="-mt-3 mb-4 text-sm text-muted">
        {fmt(challenge.start_date)} – {fmt(challenge.end_date)} · {t(challengeState(challenge, today))}
      </p>

      <section className="mb-4">
        <h2 className="mb-2 text-sm text-muted">{t("ch.leaderboard")}</h2>
        <Leaderboard rows={(board ?? []) as LeaderRow[]} sort={sort} baseHref={`/coach/business/challenges/${id}`} t={t} />
      </section>

      <Card className="mb-3">
        <h2 className="mb-1 text-sm font-medium">{t("ch.members")}</h2>
        <p className="mb-2 text-xs text-muted">{t("ch.privacy")}</p>
        <form key={[...memberIds].join()} action={saveChallengeMembers}>
          <input type="hidden" name="challenge_id" value={id} />
          <ul>
            {(clients ?? []).map((c) => (
              <li key={c.id}>
                <label className="flex items-center justify-between border-b border-line py-2.5 text-[15px]">
                  {c.full_name || "—"}
                  <input type="checkbox" name="member" value={c.id} defaultChecked={memberIds.has(c.id)} className="h-5 w-5 accent-(--accent)" />
                </label>
              </li>
            ))}
          </ul>
          <button className={`${ghostButtonClass} mt-3 w-full`}>{t("ch.saveMembers")}</button>
        </form>
      </Card>

      <Card className="mb-4">
        <form key={JSON.stringify(challenge)} action={saveChallenge} className="space-y-3">
          <input type="hidden" name="id" value={id} />
          <Field label={t("ch.name")}>
            <input name="title" required defaultValue={challenge.title} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("sub.start")}>
              <input name="start_date" type="date" required defaultValue={challenge.start_date} className={`${inputClass} num px-1`} />
            </Field>
            <Field label={t("sub.end")}>
              <input name="end_date" type="date" required defaultValue={challenge.end_date} className={`${inputClass} num px-1`} />
            </Field>
          </div>
          <Field label={t("ch.description")}>
            <textarea name="description" rows={2} defaultValue={challenge.description ?? ""} className={`${inputClass} h-auto py-2`} />
          </Field>
          <button className={`${ghostButtonClass} w-full`}>{t("w.save")}</button>
        </form>
      </Card>

      <form action={deleteChallenge}>
        <input type="hidden" name="id" value={id} />
        <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
      </form>
    </>
  );
}
