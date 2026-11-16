"use client";

import { fmtReplayTs } from "@/lib/format";
import { useReplay, useReplayAction } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/useUiStore";

const WS_DOT = { open: "bg-lv-0", connecting: "bg-lv-1", closed: "bg-lv-3" } as const;
const WS_TEXT = { open: "terhubung", connecting: "menghubungkan…", closed: "terputus, mencoba lagi" } as const;

const roundBtn =
  "flex size-8 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40";

/** "● REPLAY · Rab, 7 Jun 2017 · 16:45" + mundur / play-jeda / maju 15 menit (PLAN §2.1, §8.2). */
export function ReplayControl() {
  const { data } = useReplay();
  const action = useReplayAction();
  const wsStatus = useUiStore((s) => s.wsStatus);
  const running = data?.running ?? false;
  const atStart = data ? data.ts <= data.min_ts : true;
  const atEnd = data ? data.ts >= data.max_ts : true;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-panel py-1.5 pr-1.5 pl-3 sm:gap-2.5 sm:pl-3.5">
      <span
        className="flex items-center gap-2 text-xs font-bold tracking-[0.06em] text-lv-3-text"
        title={`Data replay Juni 2017 (bukan sensor live) · WebSocket ${WS_TEXT[wsStatus]}`}
      >
        <span className={cn("size-2 rounded-full", WS_DOT[wsStatus])} aria-hidden="true" />
        REPLAY
        <span className="sr-only">, koneksi {WS_TEXT[wsStatus]}</span>
      </span>
      <span className="mono text-xs sm:min-w-[11.5rem] sm:text-[13px]" aria-live="polite">
        {data ? (
          <>
            <span className="hidden sm:inline">{fmtReplayTs(data.ts)}</span>
            {/* phones: drop the year (always 2017) so the pill fits in 358 px */}
            <span className="sm:hidden">{fmtReplayTs(data.ts).replace(" 2017", "")}</span>
          </>
        ) : (
          "…"
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Mundur 15 menit"
          disabled={!data || atStart || action.isPending}
          onClick={() => action.mutate({ action: "step", steps: -1 })}
          className={cn(roundBtn, "border border-border-strong bg-panel text-text")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={running ? "Jeda replay" : "Putar replay"}
          disabled={!data || action.isPending}
          onClick={() => action.mutate({ action: running ? "pause" : "play" })}
          className={cn(roundBtn, "bg-text text-bg")}
        >
          {running ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          aria-label="Maju 15 menit"
          disabled={!data || atEnd || action.isPending}
          onClick={() => action.mutate({ action: "step", steps: 1 })}
          className={cn(roundBtn, "border border-border-strong bg-panel text-text")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
