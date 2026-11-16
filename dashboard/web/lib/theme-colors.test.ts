import { describe, expect, it } from "vitest";

import { heatColor, heatPosition } from "./theme-colors";

describe("heatPosition (input for the ECharts visualMap)", () => {
  it("maps the uneven stops to even positions", () => {
    expect([0, 4, 12, 22, 33.1].map((v) => heatPosition(v))).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(heatPosition(8)).toBeCloseTo(0.375); // halfway between 4 and 12
    expect(heatPosition(-1)).toBe(0);
    expect(heatPosition(40)).toBe(1);
  });
});

describe("heatColor (heatmap ramp)", () => {
  it("hits the stops exactly", () => {
    expect(heatColor(0, "dark")).toBe("rgb(22,32,43)"); // #16202B
    expect(heatColor(33.1, "dark")).toBe("rgb(238,90,90)"); // #EE5A5A
    expect(heatColor(12, "light")).toBe("rgb(247,197,72)"); // #F7C548
  });

  it("interpolates and clamps", () => {
    expect(heatColor(2, "light")).toBe("rgb(245,240,219)"); // halfway #EDF1F6 -> #FCEFC0
    expect(heatColor(-5, "dark")).toBe(heatColor(0, "dark"));
    expect(heatColor(50, "light")).toBe(heatColor(33.1, "light"));
  });
});
