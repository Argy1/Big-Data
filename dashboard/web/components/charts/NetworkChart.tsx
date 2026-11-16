"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo } from "react";

import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import type { Point } from "@/lib/api";
import { fmtDecimalHour, fmtLongDate, fmtNum } from "@/lib/format";
import { useNetworkSeries, useReplayTs } from "@/lib/queries";
import { useThemeColors, type ThemeColors } from "@/lib/theme-colors";

import { echarts } from "./echarts";
import { axisTooltip, hourAxis, lineSeries, monoFontFamily, nowMarkLine } from "./series";

const LEGEND = [
  { label: "Aktual", swatch: "h-[3px] bg-text rounded-sm" },
  { label: "Prediksi 1 jam", swatch: "h-[3px] bg-accent rounded-sm" },
  { label: "Prediksi 3 jam", swatch: "border-t-[3px] border-dotted border-pred-3h" },
  { label: "Normal (profil)", swatch: "border-t-2 border-dashed border-profile" },
];

function last(p: Point[]): Point | undefined {
  return p[p.length - 1];
}

export function buildOption(
  s: { actual: Point[]; pred_1h: Point[]; pred_3h: Point[]; profile: Point[]; now: number | null },
  c: ThemeColors,
  monoFont: string,
) {
  const all = [...s.actual, ...s.pred_1h, ...s.pred_3h, ...s.profile].map((p) => p[1]);
  const yMin = Math.floor((Math.min(...all) - 2) / 5) * 5;
  const yMax = Math.ceil((Math.max(...all) + 2) / 5) * 5;
  const actual = lineSeries("Aktual", s.actual, c.text, 2.5, "solid", 4);
  if (s.now != null) {
    Object.assign(actual, {
      markLine: nowMarkLine(s.now, c, monoFont),
      markArea: { silent: true, itemStyle: { color: c["map-b"] }, data: [[{ xAxis: s.now }, { xAxis: 24 }]] },
    });
  }
  return {
    animation: false,
    grid: { left: 44, right: 12, top: 28, bottom: 28 },
    textStyle: { fontFamily: monoFont, color: c.muted },
    xAxis: hourAxis(c),
    yAxis: {
      type: "value",
      min: yMin,
      max: yMax,
      splitNumber: 4,
      axisLabel: { color: c.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: c.grid } },
    },
    tooltip: axisTooltip(c, monoFont),
    series: [
      lineSeries("Normal (profil)", s.profile, c.profile, 1.5, "dashed", 1),
      lineSeries("Prediksi 3 jam", s.pred_3h, c["pred-3h"], 2, "dotted", 2),
      lineSeries("Prediksi 1 jam", s.pred_1h, c.accent, 2, "solid", 3),
      actual,
    ],
  };
}

/** "Kecepatan rata-rata jaringan hari ini" — PLAN §2.1, colours follow the theme (§9.5). */
export function NetworkChart() {
  const ts = useReplayTs();
  const q = useNetworkSeries(ts);
  const { theme, colors } = useThemeColors();
  const s = q.data;

  const option = useMemo(() => {
    if (!s || !colors || !s.actual.length) return null;
    return buildOption(s, colors, monoFontFamily());
  }, [s, colors]);

  const summary = useMemo(() => {
    if (!s) return "";
    const a = last(s.actual);
    const p1 = last(s.pred_1h);
    const min = s.actual.reduce((m, p) => (p[1] < m[1] ? p : m), s.actual[0] ?? [0, 0]);
    return (
      `Kecepatan rata-rata jaringan hari ini. ` +
      (a ? `Sekarang ${fmtNum(a[1])} km/jam pukul ${fmtDecimalHour(a[0])}. ` : "") +
      (min ? `Terendah sejauh ini ${fmtNum(min[1])} km/jam pukul ${fmtDecimalHour(min[0])}. ` : "") +
      (p1 ? `Prediksi 1 jam: ${fmtNum(p1[1])} km/jam pukul ${fmtDecimalHour(p1[0])}.` : "")
    );
  }, [s]);

  return (
    <Panel aria-label="Grafik kecepatan jaringan" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-bold">Kecepatan rata-rata jaringan hari ini</h2>
          <div className="mt-1 text-[13px] text-muted">
            {ts ? fmtLongDate(ts) : "…"} · km/jam · prediksi digambar pada jam yang diprediksi
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-text-2">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-2">
              <span className={`w-[22px] ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-[260px]" role="img" aria-label={summary}>
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : option ? (
          <>
            <ReactEChartsCore
              key={theme}
              echarts={echarts}
              option={option}
              notMerge
              lazyUpdate
              style={{ height: 260, width: "100%" }}
              opts={{ renderer: "canvas" }}
            />
            {s?.now != null && s.now < 21 && (
              <span
                className="pointer-events-none absolute top-10 text-xs text-muted max-sm:hidden"
                style={{ left: `calc(44px + (100% - 56px) * ${s.now / 24} + 10px)` }}
              >
                ← sudah terjadi · akan terjadi →
              </span>
            )}
          </>
        ) : (
          <Skeleton className="h-full" />
        )}
      </div>
    </Panel>
  );
}
