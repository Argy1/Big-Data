import { describe, expect, it } from "vitest";

import { addHours, fmtDecimalHour, fmtLongDate, fmtMillions, fmtNum, fmtPct, fmtReplayTs, fmtSigned } from "./format";

describe("format id-ID", () => {
  it("numbers", () => {
    expect(fmtNum(83.0798)).toBe("83,1");
    expect(fmtNum(-3.3)).toBe("−3,3");
    expect(fmtSigned(-3.3)).toBe("−3,3");
    expect(fmtSigned(2)).toBe("+2,0");
    expect(fmtPct(33.07)).toBe("33,1%");
    expect(fmtMillions(16_937_700)).toBe("16,9 jt");
    expect(fmtNum(null)).toBe("–");
  });

  it("rounds like Python (half-even), matching the backend tests", () => {
    expect(fmtNum(100.5, 0)).toBe("100"); // sensor 403225 +3 jam: 100,49 -> API 100,5 -> 100
    expect(fmtNum(99.5, 0)).toBe("100");
    expect(fmtNum(0.6785, 3)).toBe("0,678"); // recall macet 3 jam
    expect(fmtNum(0.8505, 3)).toBe("0,850"); // precision macet 1 jam
  });

  it("naive replay times (no timezone shift)", () => {
    expect(fmtReplayTs("2017-06-07T16:45:00")).toBe("Rab, 7 Jun 2017 · 16:45");
    expect(fmtLongDate("2017-06-07T16:45:00")).toBe("Rabu, 7 Juni 2017");
    expect(addHours("2017-06-07T16:45:00", 3)).toBe("2017-06-07T19:45:00");
    expect(addHours("2017-06-30T22:45:00", 3)).toBe("2017-07-01T01:45:00");
    expect(fmtDecimalHour(16.75)).toBe("16:45");
  });
});
