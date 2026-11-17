import Link from "next/link";
import { requireCoach } from "@/lib/auth";
import { addDays, formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { challengeState } from "@/components/Leaderboard";
import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { saveChallenge } from "../actions";

export default async function ChallengesPage() {
  await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const today = todayISO();
  const { data } = await supabase.from("challenges").select("id, title, start_date, end_date, challenge_members(count)").order("start_date", { ascending: false });
  const fmt = (d: string) => formatDay(d, locale, { day: "numeric", month: "short" });

  return (
    <>
      <PageTitle>{t("ch.title")}</PageTitle>
      <Card className="mb-4">
        <form action={saveChallenge} className="space-y-3">
          <Field label={t("ch.name")}>
            <input name="title" required className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("sub.start")}>
              <input name="start_date" type="date" required defaultValue={today} className={`${inputClass} num px-1`} />
            </Field>
            <Field label={t("sub.end")}>
              <input name="end_date" type="date" required defaultValue={addDays(today, 27)} className={`${inputClass} num px-1`} />
            </Field>
          </div>
          <Field label={t("ch.description")}>
            <textarea name="description" rows={2} className={`${inputClass} h-auto py-2`} />
          </Field>
          <button className={buttonClass}>+ {t("ch.new")}</button>
        </form>
      </Card>
      {!data?.length ? (
        <Card>
          <p className="text-sm text-muted">{t("ch.none")}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id}>
              <Link href={`/coach/business/challenges/${c.id}`}>
                <Card className="p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[15px] font-medium">{c.title}</span>
                    <span className="shrink-0 text-xs text-muted">{t(challengeState(c, today))}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {fmt(c.start_date)} – {fmt(c.end_date)} · <span className="num">{(c.challenge_members as { count: number }[])[0]?.count ?? 0}</span> {t("ch.members")}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
