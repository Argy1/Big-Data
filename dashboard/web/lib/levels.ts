/**
 * Single source of truth for congestion levels on the web (PLAN §7).
 * Mirror of backend/app/levels.py — both are tested with the same case table.
 */

export type Level = 0 | 1 | 2 | 3;

export const MPH_TO_KMH = 1.609344;

export const LEVEL_CODES = ["Low", "Moderate", "High", "Severe"] as const;
export const LEVEL_LABELS = ["Lancar", "Melambat", "Padat", "Macet"] as const;

/** Lower bound of the ratio for Lancar / Melambat / Padat; below RATIO_PADAT = Macet. */
export const RATIO_LANCAR = 0.8;
export const RATIO_MELAMBAT = 0.6;
export const RATIO_PADAT = 0.4;

/** Model A classes mapped by NAME (class order in model_a.joblib is heavy, light, medium). */
export const CAMERA_TO_LEVEL: Record<"light" | "medium" | "heavy", Level> = { light: 0, medium: 2, heavy: 3 };

/** Visual encodings so level never relies on colour alone (PLAN §7, §10.4). */
export const DOT_SIZE_PX: Record<Level, number> = { 0: 6, 1: 8, 2: 10, 3: 12 };
export const COLUMN_HEIGHT: Record<Level, number> = { 0: 0.08, 1: 0.5, 2: 1.05, 3: 1.8 };

export const LEVELS: Level[] = [0, 1, 2, 3];

export function mphToKmh(mph: number | null | undefined, digits: number | null = 1): number | null {
  if (mph == null || Number.isNaN(mph)) return null;
  const kmh = mph * MPH_TO_KMH;
  if (digits == null) return kmh;
  const f = 10 ** digits;
  return Math.round(kmh * f) / f;
}

export function ratioToLevel(ratio: number | null | undefined): Level | null {
  if (ratio == null || Number.isNaN(ratio)) return null;
  if (ratio < RATIO_PADAT) return 3;
  if (ratio < RATIO_MELAMBAT) return 2;
  if (ratio < RATIO_LANCAR) return 1;
  return 0;
}

export function speedToLevel(speed: number | null | undefined, vff: number | null | undefined): Level | null {
  if (speed == null || !vff) return null;
  return ratioToLevel(speed / vff);
}

export function levelLabel(level: Level | null | undefined): string {
  return level == null ? "–" : LEVEL_LABELS[level];
}

export function isCongested(level: Level | null | undefined): boolean {
  return level === 2 || level === 3;
}
