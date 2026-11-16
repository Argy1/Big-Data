"use client";

/**
 * 2D map: MapLibre + CARTO basemap (Dark Matter / Positron per theme, PLAN §9.5).
 * Changing `mapStyle` makes react-map-gl call setStyle and re-add the sensor layer itself.
 * No internet / style error -> falls back to the schematic map.
 */

import "maplibre-gl/dist/maplibre-gl.css";

import { setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { AttributionControl, Layer, Popup, Source, type MapLayerMouseEvent } from "react-map-gl/maplibre";

import { BASEMAP, useThemeColors } from "@/lib/theme-colors";

import SchematicMap from "./SchematicMap";
import { SensorTooltip } from "./SensorTooltip";
import type { MapViewProps } from "./types";

const STYLE_TIMEOUT_MS = 8000;

// The bundler moves maplibre's module, breaking its relative worker URL; serve the worker from
// public/ (copied by scripts/copy-maplibre-worker.mjs before dev/build).
setWorkerUrl("/maplibre-gl-worker.mjs");

export default function SensorMap2D(props: MapViewProps) {
  const { sensors, horizon, onSelect } = props;
  const { theme, colors } = useThemeColors();
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false); // first frame with basemap tiles rendered
  const loaded = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => !loaded.current && setFailed(true), STYLE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const geojson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: sensors.map((s, i) => ({
        type: "Feature" as const,
        id: i,
        properties: { i, level: s.level ?? -1 },
        geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
      })),
    }),
    [sensors],
  );

  const bounds = useMemo(() => {
    const lons = sensors.map((s) => s.lon);
    const lats = sensors.map((s) => s.lat);
    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [sensors]);

  if (failed) return <SchematicMap {...props} />;
  if (!colors || !sensors.length) return null;

  const hs = hover != null ? sensors[hover] : null;
  const onMove = (e: MapLayerMouseEvent) => setHover((e.features?.[0]?.properties?.i as number | undefined) ?? null);
  const onClick = (e: MapLayerMouseEvent) => {
    const i = e.features?.[0]?.properties?.i as number | undefined;
    if (i != null) onSelect(sensors[i].id);
  };

  return (
    <div className="absolute inset-0" role="img" aria-label="Peta 2D sensor di atas peta jalan: titik makin besar dan makin merah berarti makin macet.">
      <Map
        initialViewState={{ bounds, fitBoundsOptions: { padding: 32 } }}
        mapStyle={BASEMAP[theme]}
        style={{ position: "absolute", inset: 0 }}
        interactiveLayerIds={["sensors"]}
        cursor={hover != null ? "pointer" : "grab"}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={onClick}
        // "styledata" = basemap style downloaded and parsed. Not "load": that waits for the first
        // rendered frame, which a background tab may never draw, and would trip the offline timeout.
        onStyleData={() => {
          loaded.current = true;
        }}
        onLoad={() => setDrawn(true)}
        onError={(e) => {
          if (!loaded.current) setFailed(true);
          else console.warn("MapLibre:", e.error?.message);
        }}
        attributionControl={false}
        dragRotate={false}
      >
        {/* bottom-left: the level legend sits bottom-right */}
        <AttributionControl position="bottom-left" compact />
        <Source id="sensors" type="geojson" data={geojson}>
          <Layer
            id="sensors"
            type="circle"
            paint={{
              "circle-color": ["match", ["get", "level"], 0, colors["lv-0"], 1, colors["lv-1"], 2, colors["lv-2"], 3, colors["lv-3"], colors.muted],
              // radius = half the 2D dot size of PLAN §7 (6/8/10/12 px)
              "circle-radius": ["match", ["get", "level"], 0, 3, 1, 4, 2, 5, 3, 6, 3],
              "circle-opacity": ["match", ["get", "level"], 0, 0.75, 1],
              "circle-stroke-color": colors.panel,
              "circle-stroke-width": 1.5,
            }}
            layout={{ "circle-sort-key": ["get", "level"] }}
          />
        </Source>
        {hs && (
          <Popup longitude={hs.lon} latitude={hs.lat} closeButton={false} closeOnClick={false} anchor="bottom" offset={10} className="arus-popup">
            <SensorTooltip s={hs} horizon={horizon} />
          </Popup>
        )}
      </Map>
      {!drawn && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted" aria-hidden="true">
          Memuat peta…
        </div>
      )}
    </div>
  );
}
