"use client";

/**
 * Colours for things rendered in JavaScript (ECharts, three.js, MapLibre) — PLAN §9.5.
 * CSS tokens are read from <html> with getComputedStyle so they follow the active theme.
 * This file (with three.js / heatmap tables below) is the only place hex values are allowed.
 */

import { useMemo, useSyncExternalStore } from "react";

export type ThemeName = "dark" | "light";

const TOKENS = [
  "bg", "panel", "inset", "raised", "glass", "border", "border-strong",
  "text", "text-2", "muted", "accent", "link", "on-accent", "on-solid",
  "grid", "track", "map-a", "map-b", "bar-low",
  "pred-3h", "profile",
  "lv-0", "lv-1", "lv-2", "lv-3",
] as const;

export type ThemeColors = Record<(typeof TOKENS)[number], string>;

export function readThemeColors(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(TOKENS.map((t) => [t, css.getPropertyValue(`--${t}`).trim()])) as ThemeColors;
}

// Follow the data-theme attribute itself, not next-themes' React state: next-themes writes the
// attribute in an effect of the (parent) provider, which runs AFTER effects of child components,
// so reading CSS tokens on `resolvedTheme` change still returned the previous theme's colours.
function subscribeTheme(onChange: () => void) {
  const mo = new MutationObserver(onChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const themeSnapshot = (): ThemeName =>
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
const serverThemeSnapshot = (): ThemeName => "dark";

/** Current theme name + its token colours; recomputed only after <html data-theme> has changed. */
export function useThemeColors(): { theme: ThemeName; colors: ThemeColors | null } {
  const theme = useSyncExternalStore(subscribeTheme, themeSnapshot, serverThemeSnapshot);
  const colors = useMemo(
    () => (typeof document === "undefined" ? null : readThemeColors()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `theme` is the trigger: tokens live in CSS
    [theme],
  );
  return { theme, colors };
}

/** three.js scene palette per theme (PLAN §11.3, from SCENE in design/Main.dc.html). */
export const SCENE = {
  dark: {
    sky: 0xc9d6e8, gnd: 0x0b0f14, hemi: 0.85, sun: 0.9,
    ground: 0x111923, pad: 0x2a3646, gridA: 0x2a3646, gridB: 0x18222f,
    columns: [0x43c59e, 0xe8c547, 0xf39a4a, 0xee5a5a],
  },
  light: {
    sky: 0xffffff, gnd: 0xd9e1ec, hemi: 1.0, sun: 0.75,
    ground: 0xffffff, pad: 0xc5cfdc, gridA: 0xdbe2eb, gridB: 0xe9eef4,
    columns: [0x22a06b, 0xe0b000, 0xf08a24, 0xe5484d],
  },
} as const;

/** CARTO basemaps for the 2D map (PLAN §9.5). */
export const BASEMAP: Record<ThemeName, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

/** Heatmap ramp stops (value = % padat/macet), PLAN §9.5 / STOPS_D & STOPS_L in design/Analitik.dc.html. */
export const HEATMAP_STOPS: Record<ThemeName, [number, string][]> = {
  dark: [[0, "#16202B"], [4, "#2A4A60"], [12, "#E8C547"], [22, "#F39A4A"], [33.1, "#EE5A5A"]],
  light: [[0, "#EDF1F6"], [4, "#FCEFC0"], [12, "#F7C548"], [22, "#F08A24"], [33.1, "#E5484D"]],
};

/**
 * Position 0..1 of a value on the ramp, linear inside each stop segment (0,4,12,22,33.1 -> 0,¼,½,¾,1).
 * ECharts' continuous visualMap spreads its colours evenly, so feeding it this position (instead of
 * the raw %) reproduces the uneven, piecewise-linear ramp of the design exactly.
 */
export function heatPosition(value: number, theme: ThemeName = "dark"): number {
  const stops = HEATMAP_STOPS[theme];
  const n = stops.length - 1;
  for (let i = 1; i <= n; i++) {
    const a = stops[i - 1][0];
    const b = stops[i][0];
    if (value <= b || i === n) {
      const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
      return (i - 1 + t) / n;
    }
  }
  return 0;
}

const hexRgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

/** Piecewise-linear colour of a % padat/macet value on the theme's ramp (clamped at both ends). */
export function heatColor(value: number, theme: ThemeName): string {
  const stops = HEATMAP_STOPS[theme];
  for (let i = 1; i < stops.length; i++) {
    const [a, ca] = stops[i - 1];
    const [b, cb] = stops[i];
    if (value <= b || i === stops.length - 1) {
      const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
      const A = hexRgb(ca);
      const B = hexRgb(cb);
      return `rgb(${A.map((c, j) => Math.round(c + (B[j] - c) * t)).join(",")})`;
    }
  }
  return stops[0][1];
}
