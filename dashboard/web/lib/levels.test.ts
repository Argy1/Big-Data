import { describe, expect, it } from "vitest";

import { CAMERA_TO_LEVEL, isCongested, levelLabel, mphToKmh, ratioToLevel, speedToLevel } from "./levels";

// Same case table as backend/tests/test_levels.py
const RATIO_CASES: [number, number][] = [
  [1.2, 0], [0.8, 0], [0.7999, 1], [0.6, 1], [0.5999, 2],
  [0.4, 2], [0.3999, 3], [0.0, 3],
];

describe("levels (mirror of levels.py)", () => {
  it.each(RATIO_CASES)("ratio %f -> level %i", (ratio, expected) => {
    expect(ratioToLevel(ratio)).toBe(expected);
  });

  it("handles missing values", () => {
    expect(ratioToLevel(null)).toBeNull();
    expect(ratioToLevel(Number.NaN)).toBeNull();
    expect(speedToLevel(50, 0)).toBeNull();
  });

  it("sensor 403225: 99 -> 46 -> 100 km/jam = Lancar -> Padat -> Lancar", () => {
    expect([99.1, 45.9, 100.5].map((s) => speedToLevel(s, 108.95))).toEqual([0, 2, 0]);
  });

  it("converts units", () => {
    expect(mphToKmh(1)).toBe(1.6);
    expect(mphToKmh(51.6215, 1)).toBe(83.1);
    expect(mphToKmh(67.7, null)).toBeCloseTo(108.9526, 4);
    expect(mphToKmh(null)).toBeNull();
  });

  it("labels and congestion", () => {
    expect([0, 1, 2, 3].map((l) => levelLabel(l as 0))).toEqual(["Lancar", "Melambat", "Padat", "Macet"]);
    expect([0, 1, 2, 3].map((l) => isCongested(l as 0))).toEqual([false, false, true, true]);
    expect(CAMERA_TO_LEVEL).toEqual({ light: 0, medium: 2, heavy: 3 });
  });
});
