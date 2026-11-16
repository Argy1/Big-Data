import type { Level } from "@/lib/levels";

/** One sensor as drawn on the map for the selected horizon. */
export interface MapSensor {
  id: number;
  name: string;
  fwyLabel: string;
  x: number; // 0..100 schematic position (PLAN §6)
  y: number;
  lat: number;
  lon: number;
  level: Level | null; // level at the selected horizon
  levelNow: Level | null;
  speedNow: number | null;
  speed: number | null; // speed at the selected horizon (= speedNow for "Sekarang")
}

export interface FwyLabel {
  label: string;
  x: number;
  y: number;
}

export interface MapViewProps {
  sensors: MapSensor[];
  fwys: FwyLabel[];
  horizon: 0 | 1 | 2;
  onSelect: (id: number) => void;
}

/** Scene size in three.js units (PLAN §11.2) */
export const MAP_W = 10.7;
export const MAP_D = 10;
