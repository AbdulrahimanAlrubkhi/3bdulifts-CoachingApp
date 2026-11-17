import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCoach } from "@/lib/auth";
import { CLIENT_COLUMNS, instagramLink, whatsappLink, type ClientRow } from "@/lib/clients";
import { getT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/server";
import { CheckinsTab } from "./CheckinsTab";
import { NotesTab } from "./NotesTab";
import { NutritionTab } from "./NutritionTab";
import { OverviewTab } from "./OverviewTab";
import { PhotosTab } from "./PhotosTab";
import { TrainingTab } from "./TrainingTab";

const TABS = ["overview", "training", "nutrition", "checkins", "photos", "notes"] as const;
type Tab = (typeof TABS)[number];

// Client detail (spec #13, #16, #17). One page, one tab at a time, picked by ?tab=.
export default async function ClientPage({ params, searchParams }: PageProps<"/coach/clients/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : "overview";
  const coach = await requireCoach();
  const { t, locale } = await getT();
  const supabase = await createClient();

  const [{ data: profile }, { data: clientRow }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("id", id).maybeSingle(),
    supabase.from("clients").select(CLIENT_COLUMNS).eq("user_id", id).maybeSingle(),
  ]);
  if (!profile || profile.role !== "client" || !clientRow) notFound();
  const client = clientRow as ClientRow;
  const wa = whatsappLink(client.whatsapp);
  const ig = instagramLink(client.instagram);
  const ctx = { clientId: id, client, name: profile.full_name, t, locale, unit: coach.unit, sp };

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">{profile.full_name || "—"}</h1>
      <p className="mt-1 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
            WhatsApp
          </a>
        )}
        {ig && (
          <a href={ig} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
            Instagram
          </a>
        )}
        {client.email && (
          <a href={`mailto:${client.email}`} className="text-accent underline underline-offset-4" dir="ltr">
            {client.email}
          </a>
        )}
      </p>

      {/* scrolls sideways on a phone rather than wrapping onto two lines */}
      <nav className="-mx-4 mb-4 overflow-x-auto border-b border-line px-4">
        <ul className="flex gap-1 whitespace-nowrap">
          {TABS.map((key) => (
            <li key={key}>
              <Link
                href={key === "overview" ? `/coach/clients/${id}` : `/coach/clients/${id}?tab=${key}`}
                aria-current={key === tab ? "page" : undefined}
                className={`block border-b-2 px-3 py-2.5 text-sm ${key === tab ? "border-accent text-text" : "border-transparent text-muted hover:text-text"}`}
              >
                {t(`cc.tab.${key}` as TKey)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && <OverviewTab {...ctx} />}
      {tab === "training" && <TrainingTab {...ctx} />}
      {tab === "nutrition" && <NutritionTab {...ctx} />}
      {tab === "checkins" && <CheckinsTab {...ctx} />}
      {tab === "photos" && <PhotosTab {...ctx} />}
      {tab === "notes" && <NotesTab {...ctx} />}
    </>
  );
}
