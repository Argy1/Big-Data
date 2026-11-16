/** Typed client for the Arus API (contract: PLAN §8, backend/app/schemas.py). Speeds in km/jam. */

import type { Level } from "./levels";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/live";

export type Horizon = 0 | 1 | 2; // Sekarang / +1 jam / +3 jam

export interface MetaSensor {
  sensor_id: number;
  name: string;
  name_raw: string;
  fwy: number;
  dir: string;
  fwy_label: string;
  lanes: number;
  lat: number;
  lon: number;
  x: number;
  y: number;
  vff_kmh: number;
}

export interface ReplayState {
  ts: string;
  running: boolean;
  tick_seconds: number;
  min_ts: string;
  max_ts: string;
}

export interface Kpi {
  avg_speed: number | null;
  normal_speed: number | null;
  normal_hour: number;
  congested_now: number;
  congested_1h: number;
  congested_3h: number;
  normal_congested_pct: number | null;
  worse_1h: number;
  better_1h: number;
  alerts_1h: number;
  n_sensors: number;
}

export interface SnapshotSensor {
  sensor_id: number;
  speed_now: number | null;
  level_now: Level | null;
  pred_1h: number | null;
  level_1h: Level | null;
  pred_3h: number | null;
  level_3h: Level | null;
}

export interface Snapshot {
  ts: string;
  kpi: Kpi;
  counts: { now: number[]; h1: number[]; h3: number[] };
  sensors: SnapshotSensor[];
}

export type Point = [number, number];

export interface Series {
  date: string;
  actual: Point[];
  pred_1h: Point[];
  pred_3h: Point[];
  profile: Point[];
  now: number | null;
}

export interface Alert {
  sensor_id: number;
  name: string;
  fwy: number;
  dir: string;
  fwy_label: string;
  speed_now: number;
  pred: number;
  level_now: Level;
  level_pred: Level;
  drop: number;
}

export interface Hotspot {
  rank: number;
  sensor_id: number;
  name: string;
  fwy: number;
  dir: string;
  fwy_label: string;
  pct_congested: number;
  pct_severe: number;
  avg_speed: number | null;
}

export type DetectorMode = "auto" | "coco" | "finetuned";

/** One Model A decision over a 5 s window (worker/speed_layer/run_camera.py). */
export interface CameraWindow {
  camera_id: string;
  seq: number; // increases per window for the life of the worker
  loop: number; // how many times the video has looped
  t0: number; // seconds into the video
  t1: number;
  level: "light" | "medium" | "heavy";
  level_index: Level;
  conf: number;
  probs: { light: number; medium: number; heavy: number };
  features: Record<string, number | null>;
  det_mean: number;
  flow_per_min: number;
  detector: "coco" | "finetuned";
  source?: "reference"; // notebook 03 result shown while no worker runs
}

export interface Camera {
  id: string;
  name: string;
  source: string;
  original_filename: string | null;
  detector_mode: DetectorMode;
  detector_active: "coco" | "finetuned" | null;
  detector_reason: string | null;
  det_scores: { coco: number; finetuned: number } | null;
  /** live: worker streaming · starting/queued: being set up · offline: no worker · reference: CAM-01 without worker */
  status: "live" | "starting" | "queued" | "offline" | "reference" | "error";
  device_label: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  error: string | null;
  note: string | null;
  last: CameraWindow | null;
}

export interface HorizonPoint {
  ts: string;
  speed: number | null;
  ratio: number | null;
  level: Level | null;
  profile: number | null; // normal speed (bv_sensor_profile) at that weekday & hour
}

export interface SensorDetail {
  sensor_id: number;
  name: string;
  name_raw: string;
  fwy: number;
  dir: string;
  fwy_label: string;
  lanes: number;
  lat: number;
  lon: number;
  vff_kmh: number;
  now: HorizonPoint;
  h1: HorizonPoint;
  h3: HorizonPoint;
}

export interface SensorSeries extends Series {
  vff: number;
}

export interface TestMetric {
  horizon: "1h" | "3h";
  subset: string;
  method: string;
  n: number;
  mae_kmh: number;
  rmse_kmh: number;
  macro_f1: number;
  recall_congested: number;
  precision_congested: number;
}

export interface ModelMetrics {
  yolo: {
    model: string;
    classes: string[];
    map50: number;
    map50_95: number;
    precision: number;
    recall: number;
    per_class: { kelas: string; precision: number; recall: number; mAP50: number; "mAP50-95": number }[];
  };
  model_a: {
    model: string;
    features: string[];
    classes: string[];
    cv_results: Record<string, { accuracy: number; macro_f1: number }>;
    class_medians: Record<string, Record<string, number>>;
    n_clips: number;
  };
  model_b: { features: string[]; weather: boolean; best_iteration: Record<string, number>; test_metrics: TestMetric[] };
  importance_1h: { feature: string; gain: number }[];
  importance_3h: { feature: string; gain: number }[];
}

export interface Summary {
  n_readings: number;
  n_days: number;
  n_sensors: number;
  first_date: string;
  last_date: string;
  pct_congested_mean: number;
  pct_congested_max: number;
  master_mb: number;
  raw_csv_mb: number | null;
  r2_profile: number;
  holidays: string[];
}

export interface Heatmap {
  days: string[];
  hours: number[];
  values: number[][]; // [day 0=Sen][hour], % padat/macet
}

export interface DailyRow {
  date: string;
  pct_congested: number;
  avg_speed: number | null;
}

export interface Decision {
  id: number;
  sensor_id: number;
  ts: string;
  actions: string[];
  note: string | null;
  created_at: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    // FormData (uploads) sets its own multipart content type
    headers: init?.body instanceof FormData ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][];
  return p.length ? `?${new URLSearchParams(p.map(([k, v]) => [k, String(v)]))}` : "";
};

export const api = {
  metaSensors: () => request<MetaSensor[]>("/api/meta/sensors"),
  replay: () => request<ReplayState>("/api/replay"),
  replayAction: (body: { action: "play" | "pause" | "seek" | "step"; ts?: string; steps?: number }) =>
    request<ReplayState>("/api/replay", { method: "POST", body: JSON.stringify(body) }),
  snapshot: (ts?: string) => request<Snapshot>(`/api/network/snapshot${qs({ ts })}`),
  networkSeries: (date: string, ts?: string) => request<Series>(`/api/network/series${qs({ date, ts })}`),
  alerts: (ts?: string, horizon: "1h" | "3h" = "1h", limit = 6) =>
    request<Alert[]>(`/api/alerts${qs({ ts, horizon, limit })}`),
  hotspots: (limit = 8) => request<Hotspot[]>(`/api/analytics/hotspots${qs({ limit })}`),
  cameras: () => request<Camera[]>("/api/cameras"),
  cameraTimeline: (id: string, limit = 20) =>
    request<CameraWindow[]>(`/api/cameras/${encodeURIComponent(id)}/timeline${qs({ limit })}`),
  setDetector: (id: string, mode: DetectorMode) =>
    request<Camera>(`/api/cameras/${encodeURIComponent(id)}/detector`, { method: "POST", body: JSON.stringify({ mode }) }),
  uploadCamera: (file: File, name: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("name", name);
    return request<Camera>("/api/cameras", { method: "POST", body });
  },
  streamUrl: (id: string) => `${API_URL}/api/cameras/${encodeURIComponent(id)}/stream.mjpg`,
  sensor: (id: number, ts?: string) => request<SensorDetail>(`/api/sensors/${id}${qs({ ts })}`),
  sensorSeries: (id: number, date: string, ts?: string) =>
    request<SensorSeries>(`/api/sensors/${id}/series${qs({ date, ts })}`),
  modelMetrics: () => request<ModelMetrics>("/api/models/metrics"),
  summary: () => request<Summary>("/api/analytics/summary"),
  heatmap: () => request<Heatmap>("/api/analytics/heatmap"),
  daily: () => request<DailyRow[]>("/api/analytics/daily"),
  decisions: (sensorId: number) => request<Decision[]>(`/api/decisions${qs({ sensor_id: sensorId })}`),
  createDecision: (body: { sensor_id: number; ts: string; actions: string[]; note?: string }) =>
    request<{ id: number; created_at: string }>("/api/decisions", { method: "POST", body: JSON.stringify(body) }),
};
