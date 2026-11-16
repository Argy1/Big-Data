"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo } from "react";

import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import type { Heatmap as HeatmapData } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useHeatmap, useSummary } from "@/lib/queries";
import { HEATMAP_STOPS, heatColor, heatPosition, useThemeColors, type ThemeColors, type ThemeName } from "@/lib/theme-colors";

import { echarts } from "./echarts";
import { monoFontFamily, sansFontFamily } from "./series";

const DAYS_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const RAMP_SWATCHES = [0, 4, 10, 16, 24, 33];
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

function buildOption(h: HeatmapData, c: ThemeColors, theme: ThemeName, monoFont: string) {
  // [hour, day, % padat/macet, ramp position]; the visualMap colours by the position (dimension 3)
  const data = h.values.flatMap((row, d) => row.map((v, hour) => [hour, d, v, heatPosition(v, theme)]));
  return {
    visualMap: {
      show: false,
      type: "continuous",
      dimension: 3,
      min: 0,
      max: 1,
      inRange: { color: HEATMAP_STOPS[theme].map(([, color]) => color) },
    },
    animation: false,
    grid: { left: 40, right: 4, top: 4, bottom: 24 },
    textStyle: { fontFamily: monoFont },
    xAxis: {
      type: "category",
      data: h.hours.map((x) => String(x).padStart(2, "0")),
      axisLabel: { color: c.muted, fontSize: 10, interval: 2 },
      axisLine: { show: false },
      axisTick: { show: false },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: h.days,
      inverse: true, // Senin on top, like the design
      axisLabel: { color: c["text-2"], fontSize: 12, fontWeight: 500, fontFamily: sansFontFamily() },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    tooltip: {
      backgroundColor: c.panel,
      borderColor: c["border-strong"],
      textStyle: { color: c.text, fontFamily: monoFont, fontSize: 12 },
      formatter: (p: { value: [number, number, number, number] }) =>
        `${h.days[p.value[1]]} ${hh(p.value[0])} · <b>${fmtNum(p.value[2])}%</b> padat/macet`,
    },
    series: [
      {
        type: "heatmap",
        data,
        // panel-coloured borders draw the 3 px gaps between rounded cells
        itemStyle: { borderColor: c.panel, borderWidth: 3, borderRadius: 4 },
        emphasis: { itemStyle: { borderColor: c.text, borderWidth: 1 } },
      },
    ],
  };
}

/** "Kapan jaringan paling macet?" — weekday × hour heatmap of % Padat/Macet (bv_sensor_profile). */
export function Heatmap() {
  const q = useHeatmap();
  const { data: summary } = useSummary();
  const { theme, colors } = useThemeColors();
  const h = q.data;

  const option = useMemo(() => (h && colors ? buildOption(h, colors, theme, monoFontFamily()) : null), [h, colors, theme]);

  const facts = useMemo(() => {
    if (!h) return null;
    let peak = { d: 0, hour: 0, v: -1 };
    h.values.forEach((row, d) => row.forEach((v, hour) => v > peak.v && (peak = { d, hour, v })));
    const weekendMax = Math.max(...h.values[5], ...h.values[6]);
    return { peak, weekendMax };
  }, [h]);

  const summaryText = facts
    ? `Heatmap persentase pembacaan padat/macet per hari dan jam. Puncak ${DAYS_LONG[facts.peak.d]} ${hh(facts.peak.hour)} sebesar ${fmtNum(facts.peak.v)}%. Akhir pekan paling tinggi ${fmtNum(facts.weekendMax)}%.`
    : "";

  return (
    <Panel aria-label="Heatmap hari dan jam" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-bold">Kapan jaringan paling macet?</h2>
          <div className="mt-1 text-[13px] text-muted">
            % pembacaan sensor berlevel Padat/Macet · rata-rata 325 sensor · batch view bv_sensor_profile
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-2" aria-hidden="true">
          <span className="mono">0%</span>
          <span className="flex gap-0.5">
            {RAMP_SWATCHES.map((v) => (
              <span
                key={v}
                className="h-3 w-[22px] rounded-[2px] shadow-[inset_0_0_0_1px_rgba(15,23,34,0.06)]"
                style={{ background: heatColor(v, theme) }}
              />
            ))}
          </span>
          <span className="mono">33%</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        {/* overflow-hidden: the ECharts canvas rounds its width up (915 px in a 914,5 px box), which
            would otherwise show a needless horizontal scrollbar */}
        <div className="h-[262px] min-w-[760px] overflow-hidden" role="img" aria-label={summaryText}>
          {q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : option ? (
            <ReactEChartsCore
              key={theme}
              echarts={echarts}
              option={option}
              notMerge
              lazyUpdate
              style={{ height: 262, width: "100%" }}
              opts={{ renderer: "canvas" }}
            />
          ) : (
            <Skeleton className="h-full" />
          )}
        </div>
      </div>
      {facts && (
        <p className="m-0 text-[13px] text-text-2">
          Puncak:{" "}
          <span className="font-bold text-lv-3-text">
            {DAYS_LONG[facts.peak.d]} {hh(facts.peak.hour)} ({fmtNum(facts.peak.v)}%)
          </span>
          . Akhir pekan hampir selalu lancar (paling tinggi {fmtNum(facts.weekendMax)}%).
          {summary && (
            <>
              {" "}
              Pola rutin menjelaskan {fmtNum(summary.r2_profile * 100, 0)}% variasi kecepatan; sisanya{" "}
              {fmtNum((1 - summary.r2_profile) * 100, 0)}% yang ditangani Model B.
            </>
          )}
        </p>
      )}
    </Panel>
  );
}
