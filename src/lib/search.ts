/**
 * Makes search forgiving the way people actually type Arabic on a phone:
 * أ/إ/آ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي, diacritics and tatweel removed; English is lower-cased.
 * So "ارز" finds "أرز", "دجاجه" finds "دجاجة", and "Rice" finds "rice".
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every word typed appears in the Arabic or English name, in any order. */
export function matchesSearch(query: string, ...names: string[]): boolean {
  const words = normalizeForSearch(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeForSearch(names.join(" "));
  return words.every((w) => haystack.includes(w));
}
