"use client";

import { createContext, use, type ReactNode } from "react";
import { dictionaries, type Locale, type TKey } from "./dictionaries";
import type { Unit } from "../units";

type Prefs = { locale: Locale; unit: Unit; userId: string; isCoach: boolean };

const PrefsContext = createContext<Prefs>({ locale: "ar", unit: "kg", userId: "", isCoach: false });

/** Set once by the signed-in shell, so Client Components know the language, unit and user. */
export function PrefsProvider({ value, children }: { value: Prefs; children: ReactNode }) {
  return <PrefsContext value={value}>{children}</PrefsContext>;
}

export function usePrefs() {
  const prefs = use(PrefsContext);
  const dict = dictionaries[prefs.locale];
  return {
    ...prefs,
    t: (key: TKey): string => dict[key],
    /** exercise or food name in the current language */
    name: (item: { name_ar: string; name_en: string }) => (prefs.locale === "ar" ? item.name_ar : item.name_en),
  };
}
