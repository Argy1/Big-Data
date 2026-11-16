/** Shared ECharts building blocks for the day-series charts (network & sensor). */

import type { Point } from "@/lib/api";
import { fmtDecimalHour, fmtNum } from "@/lib/format";
import type { ThemeColors } from "@/lib/theme-colors";

export type LineType = "solid" | "dashed" | "dotted";

export function lineSeries(name: string, data: Point[], color: string, width: number, type: LineType, z: number) {
  return {
    name,
    type: "line" as const,
    data,
    showSymbol: false,
    symbol: "none",
    z,
    lineStyle: { color, width, type },
    itemStyle: { color },
    emphasis: { disabled: true },
  };
}

/** Vertical red "SEKARANG hh:mm" line with the label horizontal above it (design). */
export function nowMarkLine(now: number, c: ThemeColors, monoFont: string) {
  return {
    silent: true,
    symbol: "none",
    lineStyle: { color: c["lv-3"], width: 1.5, type: "solid" },
    label: {
      formatter: `SEKARANG ${fmtDecimalHour(now)}`,
      position: "end",
      distance: 2,
      backgroundColor: c["lv-3"],
      color: c["on-accent"],
      padding: [3, 8],
      borderRadius: 6,
      fontFamily: monoFont,
      fontSize: 11,
      fontWeight: 700,
    },
    data: [{ xAxis: now }],
  };
}

export function hourAxis(c: ThemeColors) {
  return {
    type: "value",
    min: 0,
    max: 24,
    interval: 3,
    axisLabel: { color: c.muted, fontSize: 11, formatter: (v: number) => String(v).padStart(2, "0") },
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
  };
}

export function axisTooltip(c: ThemeColors, monoFont: string) {
  return {
    trigger: "axis",
    backgroundColor: c.panel,
    borderColor: c["border-strong"],
    textStyle: { color: c.text, fontFamily: monoFont, fontSize: 12 },
    axisPointer: { type: "line", lineStyle: { color: c["border-strong"] } },
    formatter: (params: { seriesName: string; value: Point; color: string }[]) => {
      const rows = params.filter((p) => Array.isArray(p.value));
      if (!rows.length) return "";
      const h = fmtDecimalHour(rows[0].value[0]);
      return `${h}<br/>${rows
        .map((p) => `<span style="color:${p.color}">●</span> ${p.seriesName}: <b>${fmtNum(p.value[1])}</b> km/jam`)
        .join("<br/>")}`;
    },
  };
}

/** ECharts draws on canvas, so it needs the real (hashed) font family that next/font generated. */
export function monoFontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-jetbrains").trim() || "monospace";
}

export function sansFontFamily(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--font-jakarta").trim() || "sans-serif";
}
