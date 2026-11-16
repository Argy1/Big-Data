import { LevelChip } from "@/components/common/LevelChip";
import { fmtNum } from "@/lib/format";

import type { MapSensor } from "./types";

/** Hover card: name, freeway, speed now -> forecast, level chip. */
export function SensorTooltip({ s, horizon }: { s: MapSensor; horizon: 0 | 1 | 2 }) {
  return (
    <div className="pointer-events-none w-max max-w-[240px] rounded-[10px] border border-border-strong bg-panel px-3 py-2 text-left text-text shadow-lg">
      <div className="truncate text-[13px] font-bold">{s.name}</div>
      <div className="mono text-[11px] text-muted">
        {s.fwyLabel} · #{s.id}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="mono text-xs">
          {horizon === 0 ? (
            <>{fmtNum(s.speedNow, 0)} km/jam</>
          ) : (
            <>
              <span className="text-muted">{fmtNum(s.speedNow, 0)}</span> → <b>{fmtNum(s.speed, 0)}</b> km/jam
            </>
          )}
        </span>
        <LevelChip level={s.level} className="px-2 py-0.5 text-[11px]" />
      </div>
    </div>
  );
}
