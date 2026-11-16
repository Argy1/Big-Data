"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/common/Panel";
import { SegmentedToggle } from "@/components/common/SegmentedToggle";
import { Skeleton } from "@/components/common/States";
import type { Horizon } from "@/lib/api";
import { addHours, fmtClock } from "@/lib/format";
import { DOT_SIZE_PX, LEVEL_LABELS, type Level } from "@/lib/levels";
import { useMetaSensors, useReplayTs, useSnapshot } from "@/lib/queries";
import { useThemeColors } from "@/lib/theme-colors";
import { cn } from "@/lib/utils";
import { useUiStore, type MapView } from "@/store/useUiStore";

import { LEVEL_BG } from "../common/LevelChip";
import { webglAvailable } from "./webgl";
import type { FwyLabel, MapSensor } from "./types";

const SensorMap3D = dynamic(() => import("./SensorMap3D"), { ssr: false, loading: () => <MapLoading /> });
const SensorMap2D = dynamic(() => import("./SensorMap2D"), { ssr: false, loading: () => <MapLoading /> });

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 0, label: "Sekarang" },
  { value: 1, label: "+1 jam" },
  { value: 2, label: "+3 jam" },
];
const VIEWS: { value: MapView; label: string }[] = [
  { value: "3d", label: "3D" },
  { value: "2d", label: "2D" },
];
const COUNT_KEY = ["now", "h1", "h3"] as const;

function MapLoading() {
  return <Skeleton className="absolute inset-0 rounded-none" />;
}

/** Freeway label = median schematic position of its sensors. */
function fwyLabels(sensors: { fwy_label: string; x: number; y: number }[]): FwyLabel[] {
  const by = new Map<string, { x: number[]; y: number[] }>();
  for (const s of sensors) {
    const road = s.fwy_label.replace(/ [NSEW]$/, "");
    const g = by.get(road) ?? { x: [], y: [] };
    g.x.push(s.x);
    g.y.push(s.y);
    by.set(road, g);
  }
  const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  return [...by.entries()].map(([label, g]) => ({ label, x: med(g.x), y: med(g.y) }));
}

export function SensorMap() {
  const router = useRouter();
  const ts = useReplayTs();
  const { data: meta } = useMetaSensors();
  const { data: snap } = useSnapshot(ts);
  const { theme } = useThemeColors();
  const { horizon, setHorizon, mapView, setMapView } = useUiStore();

  // PLAN §11.4: no WebGL -> switch to 2D and tell the user once
  useEffect(() => {
    if (mapView === "3d" && !webglAvailable()) {
      setMapView("2d");
      toast("Peta 3D tidak didukung perangkat ini", { description: "Menampilkan peta 2D." });
    }
  }, [mapView, setMapView]);

  const sensors: MapSensor[] = useMemo(() => {
    if (!meta) return [];
    const bySensor = new Map(snap?.sensors.map((s) => [s.sensor_id, s]));
    return meta.map((m) => {
      const s = bySensor.get(m.sensor_id);
      const level = (s ? [s.level_now, s.level_1h, s.level_3h][horizon] : null) as Level | null;
      const speed = s ? [s.speed_now, s.pred_1h, s.pred_3h][horizon] : null;
      return {
        id: m.sensor_id,
        name: m.name,
        fwyLabel: m.fwy_label,
        x: m.x,
        y: m.y,
        lat: m.lat,
        lon: m.lon,
        level,
        levelNow: s?.level_now ?? null,
        speedNow: s?.speed_now ?? null,
        speed,
      };
    });
  }, [meta, snap, horizon]);

  const fwys = useMemo(() => (meta ? fwyLabels(meta) : []), [meta]);
  const counts = snap?.counts[COUNT_KEY[horizon]];
  const at = snap ? fmtClock(addHours(snap.ts, [0, 1, 3][horizon])) : "";
  const caption = !snap ? "Memuat…" : horizon === 0 ? `Kondisi aktual pukul ${at}` : `Prediksi Model B untuk pukul ${at}`;
  const onSelect = (id: number) => router.push(`/prediksi/${id}`);
  const ready = sensors.length > 0 && !!snap;

  return (
    <Panel aria-label="Peta kondisi sensor" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[17px] font-bold">Peta kondisi {meta?.length ?? 325} sensor</h2>
          <div className="mt-1 text-[13px] text-muted">{caption}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SegmentedToggle label="Pilih tampilan peta" options={VIEWS} value={mapView} onChange={setMapView} variant="raised" />
          <SegmentedToggle label="Pilih horizon waktu" options={HORIZONS} value={horizon} onChange={setHorizon} />
        </div>
      </div>

      <div className="relative h-[360px] w-full overflow-hidden rounded-[14px] border border-border bg-map-a md:h-[460px]">
        {!ready ? (
          <MapLoading />
        ) : mapView === "3d" ? (
          <SensorMap3D sensors={sensors} fwys={fwys} horizon={horizon} onSelect={onSelect} theme={theme} />
        ) : (
          <SensorMap2D sensors={sensors} fwys={fwys} horizon={horizon} onSelect={onSelect} />
        )}

        {mapView === "3d" && (
          <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-[10px] border border-border bg-glass px-3 py-2 text-xs text-text-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 20V12M10 20V6M16 20v-9M22 20H2" />
            </svg>
            <span className="hidden sm:inline">Tinggi kolom = tingkat kemacetan · geser untuk memutar</span>
            <span className="sm:hidden">Geser untuk memutar</span>
          </div>
        )}

        <div className="pointer-events-none absolute right-2 bottom-2 z-10 flex flex-col gap-1 rounded-[10px] border border-border bg-glass px-2.5 py-2 sm:right-3 sm:bottom-3 sm:gap-1.5 sm:px-3.5 sm:py-3">
          {([3, 2, 1, 0] as Level[]).map((l) => (
            <div key={l} className="flex items-center gap-2 text-[11px] sm:gap-2.5 sm:text-xs">
              <span className="flex w-3 flex-none justify-center">
                <span className={cn("rounded-full", LEVEL_BG[l])} style={{ width: DOT_SIZE_PX[l], height: DOT_SIZE_PX[l] }} />
              </span>
              <span className="w-[58px] text-text-2 sm:w-[70px]">{LEVEL_LABELS[l]}</span>
              <span className="mono font-semibold">{counts?.[l] ?? "–"}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="m-0 text-xs text-muted">
        Posisi dari metadata sensor PEMS-BAY. Level = kecepatan dibanding kecepatan arus bebas sensor itu sendiri. Level juga
        ditandai lewat tinggi kolom (3D) dan ukuran titik (2D), jadi tidak bergantung pada warna saja.
      </p>
    </Panel>
  );
}
