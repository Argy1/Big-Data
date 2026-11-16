"use client";

import { LEVEL_BG, LEVEL_TEXT } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { Skeleton } from "@/components/common/States";
import type { CameraWindow } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useModelMetrics } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { CLASS_META, pct, windowRange } from "./format";

const TINT = ["bg-lv-0-tint", "bg-lv-1-tint", "bg-lv-2-tint", "bg-lv-3-tint"];

/** "Keputusan Model A" for the selected window (PLAN §2.2). */
export function DecisionPanel({ current }: { current: CameraWindow | null }) {
  const { data: metrics } = useModelMetrics();
  const rf = metrics?.model_a.cv_results["Random Forest"];
  const meta = current ? CLASS_META[current.level] : null;

  return (
    <Panel aria-label="Keputusan Model A" className="flex flex-col gap-4">
      <div className="text-[13px] font-medium text-muted">Keputusan Model A{current ? ` · jendela ${windowRange(current)}` : ""}</div>
      {current && meta ? (
        <>
          <div className="flex items-center gap-3.5">
            <span className={cn("flex size-14 flex-none items-center justify-center rounded-2xl", TINT[meta.level], LEVEL_TEXT[meta.level])}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <rect x="3" y="9" width="18" height="8" rx="2" />
                <path d="M6 9l2-4h8l2 4" />
                <circle cx="7.5" cy="17.5" r="1.5" />
                <circle cx="16.5" cy="17.5" r="1.5" />
              </svg>
            </span>
            <div>
              <div className={cn("text-[32px] leading-tight font-extrabold tracking-[-0.02em] uppercase", LEVEL_TEXT[meta.level])}>{meta.label}</div>
              <div className="text-[13px] text-muted">Random Forest · 6 fitur bebas kalibrasi</div>
            </div>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Probabilitas per kelas">
            {(["light", "medium", "heavy"] as const).map((k) => {
              const m = CLASS_META[k];
              const p = current.probs[k];
              return (
                <li key={k} className="flex items-center gap-2.5 text-[13px]">
                  <span className="w-[58px]">{m.label}</span>
                  <div className="h-2.5 flex-auto rounded-[5px] bg-track">
                    <div className={cn("h-2.5 rounded-[5px]", LEVEL_BG[m.level])} style={{ width: `${Math.max(1, p * 100)}%` }} />
                  </div>
                  <span className="mono w-[52px] text-right">{pct(p)}</span>
                </li>
              );
            })}
          </ul>
          <p className="m-0 rounded-[10px] bg-inset px-3.5 py-3 text-xs leading-[1.55] text-text-2">
            Probabilitas mendekati 100% bukan kepastian: Random Forest cenderung terlalu yakin.
            {rf && ` Di UCSD (4 split resmi) akurasinya ${fmtNum(rf.accuracy * 100, 1)}%, macro-F1 ${fmtNum(rf.macro_f1, 3)}.`}
          </p>
        </>
      ) : (
        <Skeleton className="h-48" />
      )}
    </Panel>
  );
}
