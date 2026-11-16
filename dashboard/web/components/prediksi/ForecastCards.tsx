import { LevelChip } from "@/components/common/LevelChip";
import { Skeleton } from "@/components/common/States";
import type { SensorDetail } from "@/lib/api";
import { fmtClock, fmtNum } from "@/lib/format";
import { isCongested } from "@/lib/levels";
import { cn } from "@/lib/utils";

const CARDS = [
  { key: "now", title: "Sekarang" },
  { key: "h1", title: "Prediksi +1 jam" },
  { key: "h3", title: "Prediksi +3 jam" },
] as const;

/** Sekarang / +1 jam / +3 jam: speed, level chip, ratio. Padat or worse uses the warn surface (PLAN §2.3). */
export function ForecastCards({ data }: { data: SensorDetail | undefined }) {
  return (
    <section aria-label="Ringkasan prediksi" className="flex flex-wrap gap-4">
      {CARDS.map(({ key, title }) => {
        const p = data?.[key];
        const warn = isCongested(p?.level);
        return (
          <div
            key={key}
            className={cn(
              "flex min-w-0 flex-[1_1_220px] flex-col gap-2.5 rounded-panel border p-5 shadow-panel",
              warn ? "border-warn-line bg-warn-bg" : "border-border bg-panel",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-muted">{title}</span>
              <span className="mono text-xs text-muted">{p ? fmtClock(p.ts) : ""}</span>
            </div>
            {p ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="mono text-[38px] leading-[1.2] font-semibold tracking-[-0.03em]">{fmtNum(p.speed, 0)}</span>
                  <span className="text-sm text-muted">km/jam</span>
                </div>
                <div className="flex items-center gap-2">
                  <LevelChip level={p.level} className="px-3" />
                  <span className="mono text-xs text-text-2">rasio {fmtNum(p.ratio, 2)}</span>
                </div>
              </>
            ) : (
              <>
                <Skeleton className="h-[46px] w-28" />
                <Skeleton className="h-6 w-36" />
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
