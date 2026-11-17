import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS } from "@/lib/checkins";
import { weightSeries } from "@/lib/coach-metrics";
import { daysBetween, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { fmt, toDisplay } from "@/lib/units";
import { selectClass } from "@/components/ExerciseList";
import { Card, Field, PageTitle, buttonClass, ghostButtonClass, inputClass } from "@/components/ui";
import { deleteWin, saveWin } from "../../actions";

type WinRow = {
  id: string;
  client_id: string | null;
  title: string;
  quote: string | null;
  weeks: number | null;
  before_weight_kg: number | null;
  after_weight_kg: number | null;
  before_waist_cm: number | null;
  after_waist_cm: number | null;
  before_photo: string | null;
  after_photo: string | null;
  consent_given: boolean;
};

// "/coach/business/wins/new?client=…" pre-fills from that client's data; any other id edits a saved win.
export default async function WinFormPage({ params, searchParams }: PageProps<"/coach/business/wins/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const coach = await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data: clients } = await supabase.from("profiles").select("id, full_name").eq("role", "client").order("full_name");

  let win: Partial<WinRow> = {};
  let prefilled = false;
  if (id !== "new") {
    const { data } = await supabase.from("testimonials").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    win = data as WinRow;
  } else if (typeof sp.client === "string") {
    win = await prefill(supabase, sp.client, clients ?? [], locale);
    prefilled = true;
  }

  const paths = [win.before_photo, win.after_photo].filter((p): p is string => Boolean(p));
  const { data: signed } = paths.length ? await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, PHOTO_LINK_SECONDS) : { data: [] };
  const url = (p: string | null | undefined) => (p ? (signed ?? []).find((s) => s.path === p)?.signedUrl ?? null : null);
  const weightValue = (kg: number | null | undefined) => (kg == null ? "" : fmt(toDisplay(Number(kg), coach.unit)));

  return (
    <>
      <PageTitle>{id === "new" ? t("win.new") : t("win.title")}</PageTitle>

      {id === "new" && (
        // choosing a client reloads the page with numbers filled in from their data
        <form className="mb-3 flex gap-2">
          <select name="client" defaultValue={typeof sp.client === "string" ? sp.client : ""} className={`${selectClass} h-11`} aria-label={t("n.client")}>
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
          <button className={`${ghostButtonClass} h-11`}>{t("w.done")}</button>
        </form>
      )}
      {prefilled && <p className="mb-3 text-sm text-accent">{t("win.prefilled")}</p>}

      <Card>
        <form key={JSON.stringify(win)} action={saveWin} className="space-y-3">
          {id !== "new" && <input type="hidden" name="id" value={id} />}
          <input type="hidden" name="client_id" value={win.client_id ?? ""} />
          <input type="hidden" name="before_photo" value={win.before_photo ?? ""} />
          <input type="hidden" name="after_photo" value={win.after_photo ?? ""} />
          <Field label={t("win.headline")}>
            <input name="title" required defaultValue={win.title ?? ""} className={inputClass} />
          </Field>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 text-center">
            <span className="text-xs text-muted">{t("win.before")}</span>
            <span className="text-xs text-muted">{t("win.after")}</span>
            <span />
            <input name="before_weight" inputMode="decimal" defaultValue={weightValue(win.before_weight_kg)} className={`${inputClass} num text-center`} />
            <input name="after_weight" inputMode="decimal" defaultValue={weightValue(win.after_weight_kg)} className={`${inputClass} num text-center`} />
            <span className="w-20 text-start text-xs text-muted">
              {t("win.weight")} ({coach.unit})
            </span>
            <input name="before_waist_cm" inputMode="decimal" defaultValue={win.before_waist_cm ?? ""} className={`${inputClass} num text-center`} />
            <input name="after_waist_cm" inputMode="decimal" defaultValue={win.after_waist_cm ?? ""} className={`${inputClass} num text-center`} />
            <span className="w-20 text-start text-xs text-muted">{t("win.waist")}</span>
          </div>
          <Field label={t("win.weeks")}>
            <input name="weeks" inputMode="numeric" defaultValue={win.weeks ?? ""} className={`${inputClass} num w-24 text-center`} />
          </Field>
          {(win.before_photo || win.after_photo) && (
            <div>
              <p className="mb-1.5 text-sm text-muted">{t("win.photos")}</p>
              <div className="grid grid-cols-2 gap-2">
                {[win.before_photo, win.after_photo].map((p, i) => (
                  <div key={i} className="aspect-[3/4] overflow-hidden rounded-md border border-line bg-bg">
                    {url(p) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url(p)!} alt={i === 0 ? t("win.before") : t("win.after")} className="h-full w-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Field label={t("win.quote")}>
            <textarea name="quote" rows={3} defaultValue={win.quote ?? ""} className={`${inputClass} h-auto py-2`} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="consent_given" defaultChecked={win.consent_given ?? false} className="h-5 w-5 accent-(--accent)" />
            {t("win.consent")}
          </label>
          <button className={buttonClass}>{t("w.save")}</button>
        </form>
      </Card>

      {id !== "new" && (
        <form action={deleteWin} className="mt-6">
          <input type="hidden" name="id" value={id} />
          <button className={`${ghostButtonClass} text-danger`}>{t("w.delete")}</button>
        </form>
      )}
    </>
  );
}

/** Before = start of coaching (starting weight, first measurements, first front photo); after = now. */
async function prefill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  clientId: string,
  clients: { id: string; full_name: string }[],
  locale: "ar" | "en",
): Promise<Partial<WinRow>> {
  const [{ data: client }, { data: daily }, { data: weekly }] = await Promise.all([
    supabase.from("clients").select("starting_weight_kg, start_date").eq("user_id", clientId).maybeSingle(),
    supabase.from("daily_checkins").select("check_date, weight_kg").eq("user_id", clientId).not("weight_kg", "is", null).order("check_date"),
    supabase.from("weekly_checkins").select("week_start, waist_cm, photo_front").eq("user_id", clientId).order("week_start"),
  ]);
  const series = weightSeries((daily ?? []).map((d) => ({ date: d.check_date, kg: Number(d.weight_kg) })));
  const before = client?.starting_weight_kg != null ? Number(client.starting_weight_kg) : series[0]?.kg ?? null;
  // "after" uses the 7-day average, so one light day doesn't flatter the result
  const after = series.at(-1)?.avg ?? null;
  const waists = (weekly ?? []).filter((w) => w.waist_cm != null);
  const photos = (weekly ?? []).filter((w) => w.photo_front);
  const start = client?.start_date ?? daily?.[0]?.check_date ?? null;
  const weeks = start ? Math.max(1, Math.round(daysBetween(start, todayISO()) / 7)) : null;
  const name = clients.find((c) => c.id === clientId)?.full_name ?? "";
  const lost = before != null && after != null ? Math.round((before - after) * 10) / 10 : null;
  const title =
    lost != null && weeks != null && lost > 0
      ? locale === "ar"
        ? `${name}: −${lost} كغ في ${weeks} أسابيع`
        : `${name}: −${lost} kg in ${weeks} weeks`
      : name;

  return {
    client_id: clientId,
    title,
    weeks,
    before_weight_kg: before,
    after_weight_kg: after == null ? null : Math.round(after * 10) / 10,
    before_waist_cm: waists[0]?.waist_cm ?? null,
    after_waist_cm: waists.length > 1 ? waists.at(-1)!.waist_cm : null,
    before_photo: photos[0]?.photo_front ?? null,
    after_photo: photos.length > 1 ? photos.at(-1)!.photo_front : null,
    consent_given: false,
  };
}
