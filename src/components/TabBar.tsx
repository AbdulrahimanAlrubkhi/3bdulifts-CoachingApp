"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = {
  href: string;
  label: string;
  /** other path prefixes that should light up this tab */
  also?: string[];
  icon: "home" | "lift" | "food" | "check" | "more" | "people" | "book" | "card";
};

const paths: Record<Tab["icon"], string> = {
  home: "M4 11l8-6 8 6v8H4z",
  lift: "M3 12h18M6 8v8M18 8v8M9 10v4M15 10v4",
  food: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 2-2 7 0 9v9",
  check: "M5 12l4 4 10-10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  people:
    "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M16 11a3 3 0 0 0 0-6M17 14a5.5 5.5 0 0 1 4.5 5",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11",
  card: "M3 7h18v10H3zM3 11h18",
};

export function TabBar({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  // the most specific matching tab wins, so /coach/library does not also light up /coach
  const active = tabs
    .filter((t) => [t.href, ...(t.also ?? [])].some((p) => pathname === p || pathname.startsWith(p + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {tabs.map((tab) => {
          const on = tab.href === active;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${
                  on ? "text-accent" : "text-muted hover:text-text"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={paths[tab.icon]} />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
