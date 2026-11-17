import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, dictionaries, type Locale, type TKey } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("locale")?.value;
  return value === "en" || value === "ar" ? value : DEFAULT_LOCALE;
}

/** Server-side translator: `const { t, locale } = await getT()` */
export async function getT() {
  const locale = await getLocale();
  const dict = dictionaries[locale];
  return { locale, t: (key: TKey): string => dict[key] };
}
