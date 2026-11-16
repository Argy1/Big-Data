"use client";

import { LEVEL_BG } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { Skeleton } from "@/components/common/States";
import type { CameraWindow } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useModelMetrics } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { CLASS_META, pct, windowRange } from "./format";

const FEATS = [
  { key: "speed_bl_med", name: "Kecepatan median", max: 2.5, fmt: (v: number) => `${fmtNum(v, 2)} bl/s`, mark: (v: number) => fmtNum(v, 2) },
  { key: "stopped_ratio", name: "Kendaraan hampir berhenti", max: 1, fmt: (v: number) => pct(v), mark: (v: number) => `${fmtNum(v * 100, 0)}%` },
  { key: "occupancy", name: "Okupansi jalan", max: 0.4, fmt: (v: number) => pct(v), mark: (v: number) => `${fmtNum(v * 100, 0)}%` },
] as const;

/** Three key features of the window vs the median of each class in the UCSD training data (PLAN §2.2). */
export function FeatureBars({ current }: { current: CameraWindow | null }) {
  const { data: metrics } = useModelMetrics();
  const medians = metrics?.model_a.class_medians;

  return (
    <Panel aria-label="Fitur lalu lintas" className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px] font-bold">Fitur lalu lintas{current ? ` · jendela ${windowRange(current)}` : ""}</h2>
        <span className="text-[13px] text-muted">Penanda = median tiap kelas di data latih UCSD</span>
      </div>
      {current && medians ? (
        <>
          <div className="flex flex-wrap gap-4">
            {FEATS.map((f) => {
              const v = current.features[f.key];
              const marks = (["light", "medium", "heavy"] as const).map((c) => ({ c, v: medians[c]?.[f.key] ?? 0 }));
              return (
                <div key={f.key} className="flex min-w-0 flex-[1_1_240px] flex-col gap-3 rounded-xl bg-inset p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <div className="text-[13px] font-semibold">{f.name}</div>
                      <div className="mono text-[11px] text-muted">{f.key}</div>
                    </div>
                    <div className="mono text-[22px] font-semibold">{v == null ? "–" : f.fmt(v)}</div>
                  </div>
                  <div
                    className="relative h-[34px]"
                    role="img"
                    aria-label={`${f.name} ${v == null ? "tidak tersedia" : f.fmt(v)}; median Lancar ${f.mark(marks[0].v)}, Padat ${f.mark(marks[1].v)}, Macet ${f.mark(marks[2].v)}`}
                  >
                    <div className="absolute inset-x-0 top-3 h-2 rounded bg-border" />
                    <div className="absolute top-3 left-0 h-2 rounded bg-accent" style={{ width: `${Math.min(100, ((v ?? 0) / f.max) * 100)}%` }} />
                    {marks.map((m) => (
                      <span
                        key={m.c}
                        className={cn("absolute top-1 -ml-px h-6 w-[3px] rounded-sm", LEVEL_BG[CLASS_META[m.c].level])}
                        style={{ left: `${Math.min(100, (m.v / f.max) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px] text-text-2">
                    {marks.map((m) => (
                      <span key={m.c} className="flex items-center gap-1.5">
                        <span className={cn("size-2 rounded-sm", LEVEL_BG[CLASS_META[m.c].level])} />
                        {CLASS_META[m.c].label} {f.mark(m.v)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 text-[13px] text-text-2">
            <span>
              <span className="mono font-semibold">{fmtNum(current.det_mean, 1)}</span> kendaraan/frame di ROI
            </span>
            <span>
              <span className="mono font-semibold">{fmtNum(current.flow_per_min, 0)}</span> kendaraan/menit melewati garis hitung
            </span>
            <span className="text-muted">Dua angka ini tergantung luas pandang kamera, jadi tidak dipakai Model A.</span>
          </div>
        </>
      ) : (
        <Skeleton className="h-40" />
      )}
    </Panel>
  );
}
