import { computeLevel, SCORE_MAX } from "./format";
import type { CompetencyLevel } from "./types";

/** Average of non-null scores, or null when there are none. */
export function averageScore(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function averageLevel(values: (number | null | undefined)[]): CompetencyLevel | null {
  const avg = averageScore(values);
  return avg == null ? null : computeLevel(avg);
}

export function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(SCORE_MAX, Math.max(0, n));
}

/** Round to one decimal place. */
export function round1(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10;
}