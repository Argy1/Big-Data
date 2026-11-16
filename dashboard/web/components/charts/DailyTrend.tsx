"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { useMemo } from "react";

import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import type { DailyRow } from "@/lib/api";
import { fmtNum, parseNaive } from "@/lib/format";
import { useDaily, useSummary } from "@/lib/queries";
import { heatColor, useThemeColors, type ThemeColors, type ThemeName } from "@/lib/theme-colors";

import { echarts } from "./echarts";
import { monoFontFamily } from "./series";

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const LOW = 1.5; // below this the bar uses --bar-low (PLAN §9.5)

const dayLabel = (iso: string) => {
  const d = parseNaive(iso);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const isWeekend = (iso: string) => [0, 6].includes(parseNaive(iso).getDay());
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

function buildOption(rows: DailyRow[], holidays: Set<string>, c: ThemeColors, theme: ThemeName, monoFont: string) {
  return {
    animation: false,
    grid: { left: 36, right: 4, top: 8, bottom: 24 },
    textStyle: { fontFamily: monoFont },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.date),
      axisLine: { lineStyle: { color: c["border-strong"] } },
      axisTick: { show: false },
      axisLabel: {
        color: c.muted,
        fontSize: 12,
        // one label per month, on its first day
        interval: (_: number, v: string) => v.endsWith("-01"),
        formatter: (v: string) => MONTHS[Number(v.slice(5, 7)) - 1],
      },
    },
    yAxis: {
      type: "value",
      max: "dataMax",
      interval: 5,
      // the top of the axis is the data max (10,24); only label the round 0 / 5 / 10 % lines
      axisLabel: { color: c.muted, fontSize: 11, formatter: (v: number) => `${v}%`, showMaxLabel: false },
      splitLine: { lineStyle: { color: c.grid } },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow", shadowStyle: { color: c.track, opacity: 0.6 } },
      backgroundColor: c.panel,
      borderColor: c["border-strong"],
      textStyle: { color: c.text, fontFamily: monoFont, fontSize: 12 },
      formatter: (p: { dataIndex: number }[]) => {
        const r = rows[p[0].dataIndex];
        const tag = holidays.has(r.date) ? " · libur nasional AS" : isWeekend(r.date) ? " · akhir pekan" : "";
        return `${dayLabel(r.date)}${tag}<br/><b>${fmtNum(r.pct_congested)}%</b> padat/macet · ${fmtNum(r.avg_speed)} km/jam`;
      },
    },
    series: [
      {
        type: "bar",
        barCategoryGap: "12%",
        data: rows.map((r) => ({
          value: r.pct_congested,
          // ramp × 3 so a 10% day reaches the hot end of the 33% heatmap scale (design)
          itemStyle: { color: r.pct_congested < LOW ? c["bar-low"] : heatColor(r.pct_congested * 3, theme), borderRadius: [1, 1, 0, 0] },
        })),
      },
    ],
  };
}

/** "Tren harian · 181 hari": % Padat/Macet per day (bv_network_daily) — the weekday/weekend saw-tooth. */
export function DailyTrend() {
  const q = useDaily();
  const { data: summary } = useSummary();
  const { theme, colors } = useThemeColors();
  const rows = q.data;
  const holidays = useMemo(() => new Set(summary?.holidays ?? []), [summary]);

  const option = useMemo(
    () => (rows && colors ? buildOption(rows, holidays, colors, theme, monoFontFamily()) : null),
    [rows, holidays, colors, theme],
  );

  const facts = useMemo(() => {
    if (!rows) return null;
    const workdays = rows.filter((r) => !isWeekend(r.date) && !holidays.has(r.date)).map((r) => r.pct_congested);
    const weekends = rows.filter((r) => isWeekend(r.date)).map((r) => r.pct_congested);
    const top = rows.reduce((m, r) => (r.pct_congested > m.pct_congested ? r : m), rows[0]);
    return { work: mean(workdays), weekend: mean(weekends), top };
  }, [rows, holidays]);

  const holidayText = [...holidays]
    .sort()
    .map((d) => {
      const x = parseNaive(d);
      return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
    })
    .join(", ");
  const allMonday = [...holidays].every((d) => parseNaive(d).getDay() === 1);

  return (
    <Panel aria-label="Tren harian" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px] font-bold">Tren harian · {rows?.length ?? 181} hari</h2>
        <span className="text-[13px] text-muted">% pembacaan Padat/Macet per hari · batch view bv_network_daily</span>
      </div>
      <div
        className="h-[180px]"
        role="img"
        aria-label={
          facts
            ? `Tren harian ${rows?.length} hari. Hari kerja rata-rata ${fmtNum(facts.work)}%, akhir pekan rata-rata ${fmtNum(facts.weekend)}%. Tertinggi ${fmtNum(facts.top.pct_congested)}% pada ${dayLabel(facts.top.date)}.`
            : ""
        }
      >
        {q.isError ? (
          <ErrorState onRetry={() => q.refetch()} />
        ) : option ? (
          <ReactEChartsCore
            key={theme}
            echarts={echarts}
            option={option}
            notMerge
            lazyUpdate
            style={{ height: 180, width: "100%" }}
            opts={{ renderer: "canvas" }}
          />
        ) : (
          <Skeleton className="h-full" />
        )}
      </div>
      {facts && (
        <p className="m-0 text-[13px] text-text-2">
          Pola &quot;gigi gergaji&quot;: hari kerja rata-rata {fmtNum(facts.work)}% (tertinggi {fmtNum(facts.top.pct_congested)}%,{" "}
          {dayLabel(facts.top.date)}), akhir pekan rata-rata {fmtNum(facts.weekend)}%.
          {holidayText && (
            <>
              {" "}
              Libur nasional AS ({holidayText}){allMonday ? " jatuh hari Senin dan terlihat sebagai akhir pekan yang memanjang" : ""}.
            </>
          )}
        </p>
      )}
    </Panel>
  );
}
