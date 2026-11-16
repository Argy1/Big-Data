"use client";

import Link from "next/link";

import { LEVEL_TEXT, LevelChip } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { EmptyState, ErrorState, Skeleton } from "@/components/common/States";
import { addHours, fmtClock, fmtNum } from "@/lib/format";
import { useAlerts, useReplayTs, useSnapshot } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** "Peringatan dini · 1 jam": Lancar/Melambat now, Padat/Macet in 1 h (PLAN §2.1). */
export function AlertList() {
  const ts = useReplayTs();
  const alerts = useAlerts(ts);
  const { data: snap } = useSnapshot(ts);
  const total = snap?.kpi.alerts_1h;

  return (
    <Panel aria-label="Peringatan dini" className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[17px] font-bold">Peringatan dini · 1 jam</h2>
        {total != null && (
          <span className="mono rounded-full bg-lv-3-tint px-2.5 py-0.5 text-xs font-bold text-lv-3-text">{total} sensor</span>
        )}
      </div>
      <p className="m-0 text-[13px] leading-normal text-muted">
        Sekarang lancar, diprediksi Model B menjadi padat/macet pukul {ts ? fmtClock(addHours(ts, 1)) : "…"}.
      </p>
      {alerts.isError ? (
        <ErrorState onRetry={() => alerts.refetch()} />
      ) : !alerts.data ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : alerts.data.length === 0 ? (
        <EmptyState>Tidak ada sensor yang diprediksi memburuk dalam 1 jam.</EmptyState>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {alerts.data.map((a) => (
            <li key={a.sensor_id}>
              <Link
                href={`/prediksi/${a.sensor_id}`}
                className="flex items-center gap-3 border-t border-border py-3 text-text no-underline hover:text-text"
              >
                <div className="min-w-0 flex-auto">
                  <div className="truncate text-sm font-semibold">{a.name}</div>
                  <div className="mono mt-0.5 text-xs text-muted">
                    {a.fwy_label} · #{a.sensor_id}
                  </div>
                </div>
                <div className="mono text-right text-[13px] whitespace-nowrap">
                  <span className="text-muted">{fmtNum(a.speed_now, 0)}</span> →{" "}
                  <span className={cn("font-bold", LEVEL_TEXT[a.level_pred])}>{fmtNum(a.pred, 0)}</span>
                  <div className="text-[11px] text-muted">km/jam</div>
                </div>
                <LevelChip level={a.level_pred} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
