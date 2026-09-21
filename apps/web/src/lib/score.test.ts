import { describe, expect, it } from "vitest";
import { averageLevel, averageScore, clampScore, round1 } from "./score";

describe("averageScore", () => {
  it("averages non-null values", () => {
    expect(averageScore([4, 6, 8])).toBe(6);
  });
  it("ignores null/undefined entries", () => {
    expect(averageScore([4, null, 5, undefined, 6])).toBe(5);
  });
  it("returns null when there are no scores", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([null, undefined])).toBeNull();
  });
});

describe("averageLevel", () => {
  it("maps averages to KKEC levels", () => {
    expect(averageLevel([8, 9, 10])).toBe("EE");
    expect(averageLevel([6, 7, 6])).toBe("ME");
    expect(averageLevel([4, 5, 4])).toBe("AE");
    expect(averageLevel([1, 2, 3])).toBe("BE");
    expect(averageLevel([])).toBeNull();
  });
});

describe("clampScore", () => {
  it("clamps to the 0-10 scale", () => {
    expect(clampScore(12)).toBe(10);
    expect(clampScore(-3)).toBe(0);
    expect(clampScore(7.4)).toBe(7.4);
    expect(clampScore(Number.NaN)).toBe(0);
  });
});

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(6.66666)).toBe(6.7);
    expect(round1(6)).toBe(6);
    expect(round1(null)).toBeNull();
  });
});