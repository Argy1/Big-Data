"use client";

import Link from "next/link";

import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import { fmtNum, fmtPct } from "@/lib/format";
import { useHotspots } from "@/lib/queries";

/** "Hotspot kemacetan historis" — top 8 sensors by % time Padat/Macet, Jan–Jun (batch view). */
export function HotspotTable() {
  const q = useHotspots(8);
  const max = Math.max(20, ...(q.data?.map((h) => h.pct_congested) ?? [0]));

  return (
    <Panel aria-label="Hotspot kemacetan" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px] font-bold">Hotspot kemacetan historis</h2>
        <span className="text-[13px] text-muted">Batch view · Jan–Jun 2017</span>
      </div>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-2 pr-2 pb-2.5 font-semibold">#</th>
                <th scope="col" className="px-2 py-2 pb-2.5 font-semibold">Lokasi sensor</th>
                <th scope="col" className="px-2 py-2 pb-2.5 font-semibold">Ruas</th>
                <th scope="col" className="min-w-[170px] px-2 py-2 pb-2.5 font-semibold">% waktu padat/macet</th>
                <th scope="col" className="px-2 py-2 pb-2.5 text-right font-semibold">% macet</th>
                <th scope="col" className="py-2 pb-2.5 pl-2 text-right font-semibold">Rata-rata</th>
              </tr>
            </thead>
            <tbody>
              {q.data.map((h) => (
                <tr key={h.sensor_id} className="border-t border-border">
                  <td className="mono py-[11px] pr-2 text-muted">{h.rank}</td>
                  <td className="px-2 py-[11px] font-semibold">
                    <Link href={`/prediksi/${h.sensor_id}`} className="text-text no-underline hover:text-link hover:underline">
                      {h.name}
                    </Link>
                  </td>
                  <td className="mono px-2 py-[11px] whitespace-nowrap text-text-2">{h.fwy_label}</td>
                  <td className="px-2 py-[11px]">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 flex-auto rounded bg-track">
                        <div className="h-2 rounded bg-lv-2" style={{ width: `${(h.pct_congested / max) * 100}%` }} />
                      </div>
                      <span className="mono w-12 text-right">{fmtPct(h.pct_congested)}</span>
                    </div>
                  </td>
                  <td className="mono px-2 py-[11px] text-right text-lv-3-text">{fmtPct(h.pct_severe)}</td>
                  <td className="mono py-[11px] pl-2 text-right whitespace-nowrap text-text-2">{fmtNum(h.avg_speed, 0)} km/j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
