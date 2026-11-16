"use client";

import { useMemo, useState } from "react";

import { DOT_SIZE_PX } from "@/lib/levels";
import { cn } from "@/lib/utils";

import { LEVEL_BG } from "../common/LevelChip";
import { SensorTooltip } from "./SensorTooltip";
import type { MapViewProps } from "./types";

const OPACITY = ["opacity-60", "opacity-95", "opacity-100", "opacity-100"];

/** Offline 2D map: dots on a grid, positioned from lat/lon (min–max), size + colour = level. */
export default function SchematicMap({ sensors, fwys, horizon, onSelect }: MapViewProps) {
  const [hover, setHover] = useState<number | null>(null);
  // draw congested sensors last so they sit on top
  const ordered = useMemo(
    () => sensors.map((s, i) => ({ s, i })).sort((a, b) => (a.s.level ?? -1) - (b.s.level ?? -1)),
    [sensors],
  );
  const hs = hover != null ? sensors[hover] : null;

  return (
    <div
      role="img"
      aria-label="Peta 2D skematis sensor: titik makin besar dan makin merah berarti makin macet."
      className="absolute inset-0 bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-[size:48px_48px]"
    >
      <div className="absolute inset-6">
        {ordered.map(({ s, i }) => {
          const size = s.level == null ? 6 : DOT_SIZE_PX[s.level];
          return (
            <span
              key={s.id}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
              onClick={() => onSelect(s.id)}
              className={cn(
                "absolute cursor-pointer rounded-full shadow-[0_0_0_2px_var(--panel)]",
                s.level == null ? "bg-muted" : LEVEL_BG[s.level],
                s.level == null ? "opacity-60" : OPACITY[s.level],
              )}
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
            />
          );
        })}
        {fwys.map((f) => (
          <span
            key={f.label}
            className="mono pointer-events-none absolute -translate-x-1/2 -translate-y-[160%] rounded-md border border-border-strong bg-panel px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text-2"
            style={{ left: `${f.x}%`, top: `${f.y}%` }}
          >
            {f.label}
          </span>
        ))}
        {hs && (
          <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)]" style={{ left: `${hs.x}%`, top: `${hs.y}%` }}>
            <SensorTooltip s={hs} horizon={horizon} />
          </div>
        )}
      </div>
    </div>
  );
}
