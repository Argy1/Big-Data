import type { CameraWindow } from "@/lib/api";
import { fmtNum } from "@/lib/format";

/** seconds -> "00:15" (or "1:05:00" style mm:ss for long videos) */
export function mmss(t: number): string {
  const s = Math.floor(t + 1e-6);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export const windowRange = (w: CameraWindow) => `${mmss(w.t0)}–${mmss(w.t1)}`;

export const windowKey = (w: CameraWindow) => `${w.source ?? "live"}-${w.seq}`;

export const pct = (v: number | null | undefined, digits = 1) => (v == null ? "–" : `${fmtNum(v * 100, digits)}%`);

/** Model A class -> Indonesian label & level index (by name: classes_ order is heavy, light, medium). */
export const CLASS_META = {
  light: { label: "Lancar", level: 0 },
  medium: { label: "Padat", level: 2 },
  heavy: { label: "Macet", level: 3 },
} as const;
