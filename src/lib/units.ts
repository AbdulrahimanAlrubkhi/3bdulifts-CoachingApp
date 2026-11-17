// The database always stores kg. These helpers convert at the edges only.
export type Unit = "kg" | "lb";

const LB_PER_KG = 2.2046226218;

/** kg from the database -> number in the user's unit, rounded to one decimal */
export function toDisplay(kg: number | null | undefined, unit: Unit): number | null {
  if (kg == null) return null;
  const value = unit === "lb" ? Number(kg) * LB_PER_KG : Number(kg);
  return Math.round(value * 10) / 10;
}

/** number typed in the user's unit -> kg for the database */
export function toKg(value: number, unit: Unit): number {
  const kg = unit === "lb" ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

/** 80 -> "80", 82.5 -> "82.5", 12345.6 -> "12,346" */
export function fmt(value: number | null | undefined): string {
  if (value == null) return "–";
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString("en-US");
  return String(Math.round(value * 10) / 10);
}

export function fmtWeight(kg: number | null | undefined, unit: Unit): string {
  return kg == null ? "–" : `${fmt(toDisplay(kg, unit))} ${unit}`;
}

/** text from an input -> number, or null when empty or invalid */
export function parseNum(text: string): number | null {
  const value = parseFloat(text.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}
