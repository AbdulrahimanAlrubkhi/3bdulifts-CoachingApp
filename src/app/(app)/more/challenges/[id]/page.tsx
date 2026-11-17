import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { formatDay, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Leaderboard, challengeState, type LeaderRow } from "@/components/Leaderboard";
import { PageTitle } from "@/components/ui";

// A member's view of a challenge. Row-level security hides challenges the client isn't in,
// and the leaderboard function refuses non-members.
export default async function ClientChallengePage({ params, searchParams }: PageProps<"/more/challenges/[id]">) {
  const { id } = await params;
  // consistency first: it rewards showing up and suits every goal; weight change is optional
  const sort = (await searchParams).sort === "weight" ? "weight" : "consistency";
  const profile = await requireProfile();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [{ data: challenge }, { data: board }] = await Promise.all([
    supabase.from("challenges").select("id, title, description, start_date, end_date").eq("id", id).maybeSingle(),
    supabase.rpc("challenge_leaderboard", { p_challenge: id }),
  ]);
  if (!challenge) notFound();
  const fmt = (d: string) => formatDay(d, locale, { day: "numeric", month: "short" });

  return (
    <>
      <PageTitle>{challenge.title}</PageTitle>
      <p className="-mt-3 mb-2 text-sm text-muted">
        {fmt(challenge.start_date)} – {fmt(challenge.end_date)} · {t(challengeState(challenge, todayISO()))}
      </p>
      {challenge.description && <p className="mb-4 text-sm whitespace-pre-wrap">{challenge.description}</p>}
      <Leaderboard rows={(board ?? []) as LeaderRow[]} sort={sort} baseHref={`/more/challenges/${id}`} meId={profile.id} t={t} />
    </>
  );
}
