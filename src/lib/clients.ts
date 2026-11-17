export const GOALS = ["fat_loss", "muscle", "recomp", "health"] as const;
export const EXPERIENCE = ["beginner", "intermediate", "advanced"] as const;
export const PLACES = ["gym", "home", "both"] as const;

/** Client profile columns (spec #13); `onboarding` holds the questionnaire answers that have no column of their own. */
export type ClientRow = {
  user_id: string;
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  birth_date: string | null;
  height_cm: number | null;
  starting_weight_kg: number | null;
  goal: string | null;
  injuries: string | null;
  experience: string | null;
  availability: string | null;
  training_days_per_week: number | null;
  start_date: string | null;
  onboarding: Record<string, string> | null;
  onboarded_at: string | null;
};

export const CLIENT_COLUMNS =
  "user_id, whatsapp, instagram, email, birth_date, height_cm, starting_weight_kg, goal, injuries, experience, availability, training_days_per_week, start_date, onboarding, onboarded_at";

/** Whole years between a birth date and `today` (both ISO dates). */
export function ageOn(birthDate: string | null, today: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** "+968 9123 4567" -> "96891234567", for wa.me links. */
export function whatsappLink(number: string | null) {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function instagramLink(handle: string | null) {
  const h = (handle ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");
  return h ? `https://instagram.com/${h}` : null;
}
