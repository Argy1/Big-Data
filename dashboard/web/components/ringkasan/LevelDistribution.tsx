"use client";

import { LEVEL_BG } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { Skeleton } from "@/components/common/States";
import { addHours, fmtClock } from "@/lib/format";
import { LEVEL_LABELS } from "@/lib/levels";
import { useReplayTs, useSnapshot } from "@/lib/queries";

const ROWS = [
  { key: "now", label: "Sekarang", hours: 0 },
  { key: "h1", label: "+1 jam", hours: 1 },
  { key: "h3", label: "+3 jam", hours: 3 },
] as const;

/** Three stacked bars: share of the 4 levels now / +1 h / +3 h (PLAN §2.1). */
export function LevelDistribution() {
  const ts = useReplayTs();
  const { data: snap } = useSnapshot(ts);

  return (
    <Panel aria-label="Distribusi level" className="flex flex-col gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">Distribusi level kemacetan</h2>
      {ROWS.map((r) => {
        const counts = snap?.counts[r.key];
        const total = counts?.reduce((a, b) => a + b, 0) || 1;
        const label = `${r.label} · ${snap ? fmtClock(addHours(snap.ts, r.hours)) : "…"}`;
        return (
          <div key={r.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold">{label}</span>
              <span className="mono text-muted">{counts ? counts[2] + counts[3] : "–"} padat/macet</span>
            </div>
            {counts ? (
              <div
                className="flex h-3.5 gap-0.5 overflow-hidden rounded"
                role="img"
                aria-label={`${label}: ${counts.map((c, i) => `${LEVEL_LABELS[i]} ${c}`).join(", ")}`}
              >
                {counts.map((c, i) => (
                  <span key={i} className={LEVEL_BG[i]} style={{ width: `${(c / total) * 100}%` }} />
                ))}
              </div>
            ) : (
              <Skeleton className="h-3.5" />
            )}
          </div>
        );
      })}
    </Panel>
  );
}
