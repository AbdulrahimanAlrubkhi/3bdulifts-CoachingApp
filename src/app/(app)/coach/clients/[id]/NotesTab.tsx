import { formatDay, isISODate, todayISO, weekStartOf, addDays, dateInAppTz } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { Card, buttonInlineClass, ghostButtonClass, inputClass } from "@/components/ui";
import { addCoachNote, deleteCoachNote, saveFeedback } from "./actions";
import type { TabProps } from "./tab-props";

// Private coach notes and the weekly feedback the client reads (spec #17).
export async function NotesTab({ clientId, t, locale, sp }: TabProps) {
  const supabase = await createClient();
  const thisWeek = weekStartOf(todayISO());
  const week = isISODate(sp.week) ? weekStartOf(sp.week as string) : thisWeek;

  const [{ data: notes }, { data: feedback }] = await Promise.all([
    supabase.from("coach_notes").select("id, body, created_at").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("weekly_feedback").select("week_start, body, read_at").eq("client_id", clientId).order("week_start", { ascending: false }),
  ]);
  const current = (feedback ?? []).find((f) => f.week_start === week);
  const dayFmt = { day: "numeric", month: "short" } as const;
  const weekLink = (w: string) => `/coach/clients/${clientId}?tab=notes${w === thisWeek ? "" : `&week=${w}`}`;

  return (
    <div className="space-y-3">
      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t("cc.feedback")}</h2>
          {/* step a week back or forward; never past the current week */}
          <span className="flex items-center gap-1 text-xs">
            <a href={weekLink(addDays(week, -7))} aria-label={t("n.prevDay")} className="rounded border border-line px-2 py-1 text-muted">
              <span className="inline-block rtl:rotate-180">‹</span>
            </a>
            <span className="px-1">
              {t("c.weekOf")} {formatDay(week, locale, dayFmt)}
            </span>
            {week < thisWeek ? (
              <a href={weekLink(addDays(week, 7))} aria-label={t("n.nextDay")} className="rounded border border-line px-2 py-1 text-muted">
                <span className="inline-block rtl:rotate-180">›</span>
              </a>
            ) : (
              <span className="w-7" />
            )}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">{t("cc.feedbackHint")}</p>
        <form key={`${week}-${current?.body ?? ""}`} action={saveFeedback} className="space-y-2">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="week" value={week} />
          <textarea name="body" rows={6} defaultValue={current?.body ?? ""} className={`${inputClass} h-auto py-2`} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{current ? (current.read_at ? `✓ ${t("cc.read")}` : t("cc.unread")) : ""}</span>
            <button className={`${buttonInlineClass}`}>{t("cc.sendFeedback")}</button>
          </div>
        </form>
        {(feedback ?? []).length > 0 && (
          <ul className="mt-4 border-t border-line pt-2 text-sm">
            {(feedback ?? []).map((f) => (
              <li key={f.week_start}>
                <a href={weekLink(f.week_start)} className={`flex justify-between gap-3 py-1.5 ${f.week_start === week ? "text-accent" : ""}`}>
                  <span>
                    {t("c.weekOf")} {formatDay(f.week_start, locale, dayFmt)}
                  </span>
                  <span className="text-xs text-muted">{f.read_at ? `✓ ${t("cc.read")}` : t("cc.unread")}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-medium">{t("cc.privateNotes")}</h2>
        <p className="mb-3 text-xs text-muted">{t("cc.privateHint")}</p>
        <form action={addCoachNote} className="space-y-2">
          <input type="hidden" name="client_id" value={clientId} />
          <textarea name="body" rows={3} required className={`${inputClass} h-auto py-2`} />
          <button className={`${ghostButtonClass} w-full`}>+ {t("cc.addNote")}</button>
        </form>
        <ul className="mt-3 space-y-3">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="border-t border-line pt-3">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>{formatDay(dateInAppTz(n.created_at), locale, { day: "numeric", month: "short", year: "numeric" })}</span>
                <form action={deleteCoachNote}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="hover:text-danger">{t("w.delete")}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
