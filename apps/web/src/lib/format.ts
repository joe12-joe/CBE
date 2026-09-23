import type { CompetencyLevel, GradeCode, LevelDefinition } from "./types";

/** Score scale is 0-10 per sub-strand. */
export const SCORE_MAX = 10;

export const GRADE_ORDER: GradeCode[] = [
  "PP1",
  "PP2",
  "G1",
  "G2",
  "G3",
  "G4",
  "G5",
  "G6",
  "G7",
  "G8",
  "G9",
];

export const GRADE_LABEL: Record<GradeCode, string> = {
  PP1: "Pre-Primary 1",
  PP2: "Pre-Primary 2",
  G1: "Grade 1",
  G2: "Grade 2",
  G3: "Grade 3",
  G4: "Grade 4",
  G5: "Grade 5",
  G6: "Grade 6",
  G7: "Grade 7",
  G8: "Grade 8",
  G9: "Grade 9",
};

export const LEVELS: LevelDefinition[] = [
  { level: "EE", min: 8, label: "Exceeding Expectation", description: "Excels beyond the expected level of performance in the competency." },
  { level: "ME", min: 6, label: "Meeting Expectation", description: "Consistently meets the expected level of performance in the competency." },
  { level: "AE", min: 4, label: "Approaching Expectation", description: "Partially meets the expected level of performance in the competency." },
  { level: "BE", min: 0, label: "Below Expectation", description: "Performs below the expected level of performance in the competency." },
];

export function computeLevel(score: number | null): CompetencyLevel | null {
  if (score == null || Number.isNaN(score)) return null;
  for (const def of LEVELS) {
    if (score >= def.min) return def.level;
  }
  return "BE";
}

export function levelLabel(level: CompetencyLevel): string {
  return LEVELS.find((l) => l.level === level)?.label ?? level;
}

export function levelSort(level: CompetencyLevel): number {
  return LEVELS.findIndex((l) => l.level === level);
}

export function levelColor(level: CompetencyLevel): string {
  switch (level) {
    case "EE":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "ME":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "AE":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "BE":
      return "bg-red-100 text-red-800 border-red-200";
  }
}

export function levelDot(level: CompetencyLevel): string {
  switch (level) {
    case "EE":
      return "bg-emerald-500";
    case "ME":
      return "bg-sky-500";
    case "AE":
      return "bg-amber-500";
    case "BE":
      return "bg-red-500";
  }
}

export function formatScore(score: number | null): string {
  if (score == null) return "—";
  return score.toFixed(1);
}

export function formatUp(i: string): string {
  const digits = i.replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function termLabel(term: { year: number; term: number }): string {
  const n = ["", "Term 1", "Term 2", "Term 3"][term.term] ?? `Term ${term.term}`;
  return `${n} — ${term.year}`;
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  // Treat "YYYY-MM-DD" as a local date so timezone shifts don't move the day.
  const local = iso.length === 10 ? `${iso}T00:00:00` : iso;
  return new Date(local).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function resolveGrade(grade: GradeCode): GradeCode {
  return grade;
}