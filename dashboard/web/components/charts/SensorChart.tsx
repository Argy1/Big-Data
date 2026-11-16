"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo, useState } from "react";

import { Panel } from "@/components/common/Panel";
import { SegmentedToggle } from "@/components/common/SegmentedToggle";
import { ErrorState, Skeleton } from "@/components/common/States";
import type { Point, SensorSeries } from "@/lib/api";
import { dayLong, fmtDecimalHour, fmtNum } from "@/lib/format";
import { RATIO_LANCAR, RATIO_MELAMBAT, RATIO_PADAT } from "@/lib/levels";
import { useSensorSeries } from "@/lib/queries";
import { useThemeColors, type ThemeColors } from "@/lib/theme-colors";

import { echarts } from "./echarts";
import { axisTooltip, hourAxis, lineSeries, monoFontFamily, nowMarkLine } from "./series";

type Show = "1h" | "3h" | "both";
const SHOW_OPTIONS: { value: Show; label: string }[] = [
  { value: "1h", label: "1 jam" },
  { value: "3h", label: "3 jam" },
  { value: "both", label: "Keduanya" },
];

const last = (p: Point[]): Point | undefined => p[p.length - 1];

/** Value label on the last forecast point: "17:45 · 46 km/jam", bordered in the series colour. */
function predLabel(p: Point, border: string, c: ThemeColors, monoFont: string) {
  return {
    silent: true,
    symbol: "circle",
    symbolSize: 7,
    itemStyle: { color: border },
    label: {
      show: true,
      position: "top",
      distance: 8,
      formatter: `${fmtDecimalHour(p[0])} · ${fmtNum(p[1], 0)} km/jam`,
      backgroundColor: c.panel,
      borderColor: border,
      borderWidth: 1,
      borderRadius: 6,
      padding: [3, 8],
      color: c.text,
      fontFamily: monoFont,
      fontSize: 11,
      fontWeight: 600,
    },
    data: [{ coord: p }],
  };
}

export function buildSensorOption(s: SensorSeries, show: Show, c: ThemeColors, monoFont: string) {
  const vals = [...s.actual, ...s.pred_1h, ...s.pred_3h, ...s.profile].map((p) => p[1]);
  // multiples of 20 so the 20-km/jam grid lines start and end on round numbers
  const yMax = Math.ceil((Math.max(s.vff, ...vals) + 6) / 20) * 20;
  const yMin = Math.max(0, Math.floor((Math.min(...vals) - 6) / 20) * 20);

  // background bands per level: ratio thresholds × this sensor's v_ff (PLAN §2.3)
  const band = (from: number, to: number, color: string, opacity: number) => [
    { yAxis: from, itemStyle: { color, opacity } },
    { yAxis: to },
  ];
  const bands = {
    type: "line" as const,
    data: [],
    silent: true,
    markArea: {
      silent: true,
      data: [
        band(RATIO_LANCAR * s.vff, yMax, c["lv-0"], 0.07),
        band(RATIO_MELAMBAT * s.vff, RATIO_LANCAR * s.vff, c["lv-1"], 0.09),
        band(RATIO_PADAT * s.vff, RATIO_MELAMBAT * s.vff, c["lv-2"], 0.1),
        band(yMin, RATIO_PADAT * s.vff, c["lv-3"], 0.1),
      ],
    },
    markLine: {
      silent: true,
      symbol: "none",
      lineStyle: { color: c["lv-0"], width: 1, type: [3, 5] },
      label: { formatter: `v_ff ${fmtNum(s.vff, 0)}`, position: "insideEndTop", color: c["lv-0"], fontFamily: monoFont, fontSize: 11 },
      data: [{ yAxis: s.vff }],
    },
  };

  const actual = lineSeries("Aktual", s.actual, c.text, 2.5, "solid", 5);
  if (s.now != null) Object.assign(actual, { markLine: nowMarkLine(s.now, c, monoFont) });

  const p1 = lineSeries("Prediksi 1 jam", show === "3h" ? [] : s.pred_1h, c.accent, 2, "solid", 4);
  const p3 = lineSeries("Prediksi 3 jam", show === "1h" ? [] : s.pred_3h, c["pred-3h"], 2, "dotted", 3);
  // label the newest forecast of each visible horizon (the one made "now")
  const l1 = last(s.pred_1h);
  const l3 = last(s.pred_3h);
  if (show !== "3h" && l1) Object.assign(p1, { markPoint: predLabel(l1, c.accent, c, monoFont) });
  if (show !== "1h" && l3) Object.assign(p3, { markPoint: predLabel(l3, c["pred-3h"], c, monoFont) });

  return {
    animation: false,
    grid: { left: 44, right: 12, top: 32, bottom: 28 },
    textStyle: { fontFamily: monoFont, color: c.muted },
    xAxis: hourAxis(c),
    yAxis: {
      type: "value",
      min: yMin,
      max: yMax,
      interval: 20,
      axisLabel: { color: c.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: c.grid } },
    },
    tooltip: axisTooltip(c, monoFont),
    series: [bands, lineSeries("Normal (profil)", s.profile, c.profile, 1.5, "dashed", 2), p3, p1, actual],
  };
}

/** "Kecepatan sensor hari ini": zones, v_ff, profile, actual, +1 h / +3 h forecasts (PLAN §2.3). */
export function SensorChart({ sensorId, ts, name }: { sensorId: number; ts: string | undefined; name: string }) {
  const q = useSensorSeries(sensorId, ts);
  const { theme, colors } = useThemeColors();
  const [show, setShow] = useState<Show>("both");
  const s = q.data;

  const option = useMemo(
    () => (s && colors && s.actual.length ? buildSensorOption(s, show, colors, monoFontFamily()) : null),
    [s, show, colors],
  );

  const summary = useMemo(() => {
    if (!s) return "";
    const a = last(s.actual);
    const p1 = last(s.pred_1h);
    const p3 = last(s.pred_3h);
    return (
      `Kecepatan sensor ${name} hari ini. ` +
      (a ? `Sekarang ${fmtNum(a[1], 0)} km/jam pukul ${fmtDecimalHour(a[0])}. ` : "") +
      (p1 ? `Prediksi 1 jam: ${fmtNum(p1[1], 0)} km/jam pukul ${fmtDecimalHour(p1[0])}. ` : "") +
      (p3 ? `Prediksi 3 jam: ${fmtNum(p3[1], 0)} km/jam pukul ${fmtDecimalHour(p3[0])}. ` : "") +
      `Kecepatan arus bebas ${fmtNum(s.vff, 0)} km/jam.`
    );
  }, [s, name]);

  const legend = [
    { label: "Aktual", swatch: "h-[3px] rounded-sm bg-text", on: true },
    { label: "Prediksi 1 jam", swatch: "h-[3px] rounded-sm bg-accent", on: show !== "3h" },
    { label: "Prediksi 3 jam", swatch: "border-t-[3px] border-dotted border-pred-3h", on: show !== "1h" },
    { label: `Normal ${ts ? dayLong(ts) : ""} (profil historis)`, swatch: "border-t-2 border-dashed border-profile", on: true },
  ];

  return (
    <Panel aria-label="Grafik prediksi sensor" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-bold">Kecepatan sensor hari ini</h2>
          <div className="mt-1 text-[13px] text-muted">Latar berwarna = zona level · prediksi digambar pada jam yang diprediksi</div>
        </div>
        <SegmentedToggle label="Tampilkan horizon" options={SHOW_OPTIONS} value={show} onChange={setShow} />
      </div>
      <div className="relative h-[300px]" role="img" aria-label={summary}>
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : option ? (
          <ReactEChartsCore
            key={theme}
            echarts={echarts}
            option={option}
            notMerge
            lazyUpdate
            style={{ height: 300, width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        ) : (
          <Skeleton className="h-full" />
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-text-2">
        {legend
          .filter((l) => l.on)
          .map((l) => (
            <span key={l.label} className="flex items-center gap-2">
              <span className={`w-[22px] ${l.swatch}`} aria-hidden="true" />
              {l.label}
            </span>
          ))}
      </div>
    </Panel>
  );
}
