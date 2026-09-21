import { describe, expect, it } from "vitest";
import { computeLevel, levelLabel, formatUp, termLabel, initials, formatDate } from "./format";

describe("computeLevel", () => {
  it("maps scores to KKEC levels using thresholds", () => {
    expect(computeLevel(10)).toBe("EE");
    expect(computeLevel(8)).toBe("EE");
    expect(computeLevel(7.9)).toBe("ME");
    expect(computeLevel(6)).toBe("ME");
    expect(computeLevel(5.9)).toBe("AE");
    expect(computeLevel(4)).toBe("AE");
    expect(computeLevel(3.9)).toBe("BE");
    expect(computeLevel(0)).toBe("BE");
  });
  it("returns null for missing scores", () => {
    expect(computeLevel(null)).toBeNull();
    expect(computeLevel(Number.NaN)).toBeNull();
  });
});

describe("levelLabel", () => {
  it("expands abbreviations", () => {
    expect(levelLabel("EE")).toBe("Exceeding Expectation");
    expect(levelLabel("BE")).toBe("Below Expectation");
  });
});

describe("formatUp", () => {
  it("groups UPI digits", () => {
    expect(formatUp("6012345678")).toBe("601 234 5678");
  });
});

describe("termLabel", () => {
  it("formats a term", () => {
    expect(termLabel({ year: 2026, term: 3 })).toBe("Term 3 — 2026");
  });
});

describe("initials", () => {
  it("uses the first letters of the first two words", () => {
    expect(initials("Mary Wanjiku")).toBe("MW");
    expect(initials("Joseph Kiptoo Kimani")).toBe("JK");
  });
});

describe("formatDate", () => {
  it("formats ISO dates", () => {
    expect(formatDate("2015-03-02")).toBe("2 Mar 2015");
    expect(formatDate("")).toBe("—");
  });
});