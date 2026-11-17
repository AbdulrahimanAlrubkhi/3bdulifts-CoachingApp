import { requireProfile } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Card, PageTitle } from "@/components/ui";

// Every week of feedback from the coach, newest first (spec #17). Opening the page marks them read.
export default async function FeedbackPage() {
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const { data } = await supabase
    .from("weekly_feedback")
    .select("week_start, body, read_at")
    .eq("client_id", profile.id)
    .order("week_start", { ascending: false });
  const feedback = data ?? [];

  // the client may only set read_at; a database trigger stops any other change
  if (feedback.some((f) => !f.read_at)) {
    await supabase.from("weekly_feedback").update({ read_at: new Date().toISOString() }).eq("client_id", profile.id).is("read_at", null);
  }

  return (
    <>
      <PageTitle>{t("fb.title")}</PageTitle>
      {!feedback.length ? (
        <Card>
          <p className="text-sm text-muted">{t("fb.none")}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {feedback.map((f) => (
            <li key={f.week_start}>
              <Card className={f.read_at ? "" : "border-accent"}>
                <p className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>
                    {t("c.weekOf")} {formatDay(f.week_start, locale, { day: "numeric", month: "long" })}
                  </span>
                  {!f.read_at && <span className="text-accent">{t("fb.new")}</span>}
                </p>
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{f.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
