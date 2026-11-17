export const MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps", "forearms", "core",
  "quads", "hamstrings", "glutes", "calves", "full_body", "cardio",
] as const;

export const EQUIPMENT = [
  "barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "other",
] as const;

export type Exercise = {
  id: string;
  name_ar: string;
  name_en: string;
  muscle: (typeof MUSCLES)[number];
  equipment: (typeof EQUIPMENT)[number];
  is_global: boolean;
  created_by: string | null;
};

export const EXERCISE_COLUMNS = "id, name_ar, name_en, muscle, equipment, is_global, created_by";
