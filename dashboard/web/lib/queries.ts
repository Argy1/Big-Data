"use client";

/**
 * React Query hooks. Everything that depends on replay time has `ts` in its query key,
 * so a WebSocket `tick` (which updates ["replay"]) refetches those panels automatically.
 */

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { MAX_CAMERA_WINDOWS, useUiStore } from "@/store/useUiStore";

import { api, ApiError, type CameraWindow, type DetectorMode, type ReplayState } from "./api";
import { dateOnly } from "./format";

export const qk = {
  replay: ["replay"] as const,
};

export function useReplay() {
  return useQuery({ queryKey: qk.replay, queryFn: api.replay, staleTime: Infinity });
}

/** Current replay timestamp, or undefined while loading. */
export function useReplayTs(): string | undefined {
  return useReplay().data?.ts;
}

export function useReplayAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.replayAction,
    onSuccess: (state: ReplayState) => qc.setQueryData(qk.replay, state),
  });
}

export function useMetaSensors() {
  return useQuery({ queryKey: ["meta", "sensors"], queryFn: api.metaSensors, staleTime: Infinity });
}

export function useSnapshot(ts: string | undefined) {
  return useQuery({
    queryKey: ["snapshot", ts],
    queryFn: () => api.snapshot(ts),
    enabled: !!ts,
    placeholderData: keepPreviousData,
  });
}

export function useAlerts(ts: string | undefined, limit = 6) {
  return useQuery({
    queryKey: ["alerts", ts, limit],
    queryFn: () => api.alerts(ts, "1h", limit),
    enabled: !!ts,
    placeholderData: keepPreviousData,
  });
}

export function useNetworkSeries(ts: string | undefined) {
  return useQuery({
    queryKey: ["series", "network", ts],
    queryFn: () => api.networkSeries(dateOnly(ts!), ts),
    enabled: !!ts,
    placeholderData: keepPreviousData,
  });
}

export function useHotspots(limit = 8) {
  return useQuery({ queryKey: ["hotspots", limit], queryFn: () => api.hotspots(limit), staleTime: Infinity });
}

export function useSensor(id: number, ts: string | undefined) {
  return useQuery({
    queryKey: ["sensor", id, ts],
    queryFn: () => api.sensor(id, ts),
    enabled: !!ts && Number.isFinite(id),
    placeholderData: keepPreviousData,
    retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 1,
  });
}

export function useSensorSeries(id: number, ts: string | undefined) {
  return useQuery({
    queryKey: ["series", "sensor", id, ts],
    queryFn: () => api.sensorSeries(id, dateOnly(ts!), ts),
    enabled: !!ts && Number.isFinite(id),
    placeholderData: keepPreviousData,
    retry: (n, err) => !(err instanceof ApiError && err.status === 404) && n < 1,
  });
}

export function useModelMetrics() {
  return useQuery({ queryKey: ["models", "metrics"], queryFn: api.modelMetrics, staleTime: Infinity });
}

// Batch views never change while the app runs: fetch once
export function useSummary() {
  return useQuery({ queryKey: ["analytics", "summary"], queryFn: api.summary, staleTime: Infinity });
}

export function useHeatmap() {
  return useQuery({ queryKey: ["analytics", "heatmap"], queryFn: api.heatmap, staleTime: Infinity });
}

export function useDaily() {
  return useQuery({ queryKey: ["analytics", "daily"], queryFn: api.daily, staleTime: Infinity });
}

export function useDecisions(sensorId: number) {
  return useQuery({ queryKey: ["decisions", sensorId], queryFn: () => api.decisions(sensorId) });
}

export function useCreateDecision(sensorId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDecision,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions", sensorId] }),
  });
}

export function useCameras() {
  return useQuery({ queryKey: ["cameras"], queryFn: api.cameras, refetchInterval: 5_000 });
}

/**
 * Windows of one camera: the last 20 from the API (history on page load) merged with the ones pushed
 * over the WebSocket since, ordered oldest -> newest, max 40 (PLAN §8.3).
 */
export function useCameraWindows(id: string | null): CameraWindow[] {
  const history = useQuery({
    queryKey: ["cameras", id, "timeline"],
    queryFn: () => api.cameraTimeline(id!, 20),
    enabled: !!id,
    refetchInterval: 15_000, // also picks up windows when the WebSocket was briefly down
  }).data;
  const live = useUiStore((s) => (id ? s.cameraWindows[id] : undefined));
  return useMemo(() => {
    const bySeq = new Map<string, CameraWindow>();
    for (const w of [...(history ?? []), ...(live ?? [])]) bySeq.set(`${w.source ?? "live"}-${w.seq}`, w);
    const all = [...bySeq.values()];
    // the worker's seq restarts when it restarts: keep only the newest run if both are mixed
    const live_ = all.filter((w) => w.source !== "reference");
    const list = (live_.length ? live_ : all).sort((a, b) => a.seq - b.seq);
    return list.slice(-MAX_CAMERA_WINDOWS);
  }, [history, live]);
}

export function useSetDetector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: DetectorMode }) => api.setDetector(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  });
}

export function useUploadCamera() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) => api.uploadCamera(file, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cameras"] }),
  });
}
