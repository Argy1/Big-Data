"use client";

/**
 * useLiveSocket — one WebSocket to /ws/live for the whole app (PLAN §8.3).
 * Reconnects with backoff 1 -> 10 s. `tick`/`replay` messages update the ["replay"] query,
 * which re-keys every ts-dependent query. Switching theme never touches this connection.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useUiStore } from "@/store/useUiStore";

import { WS_URL, type CameraWindow, type Kpi, type ReplayState } from "./api";
import { qk } from "./queries";

type LiveMessage =
  | { type: "tick"; ts: string; kpi: Kpi }
  | ({ type: "replay" } & ReplayState)
  | { type: "camera"; camera_id: string; window: CameraWindow };

export function useLiveSocket() {
  const qc = useQueryClient();
  const setStatus = useUiStore((s) => s.setWsStatus);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let delay = 1000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let connectedBefore = false;

    const connect = () => {
      setStatus("connecting");
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        delay = 1000;
        setStatus("open");
        // reconnect (API restarted, network blip): ticks/camera windows sent meanwhile were missed,
        // and a restarted API is back at the default replay time, so refetch everything once
        if (connectedBefore) qc.invalidateQueries();
        connectedBefore = true;
      };
      ws.onmessage = (ev) => {
        let msg: LiveMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "tick") {
          qc.setQueryData<ReplayState>(qk.replay, (old) => (old ? { ...old, ts: msg.ts } : old));
          if (!qc.getQueryData(qk.replay)) qc.invalidateQueries({ queryKey: qk.replay });
        } else if (msg.type === "replay") {
          qc.setQueryData<ReplayState>(qk.replay, {
            ts: msg.ts,
            running: msg.running,
            tick_seconds: msg.tick_seconds,
            min_ts: msg.min_ts,
            max_ts: msg.max_ts,
          });
        }
        else if (msg.type === "camera") {
          useUiStore.getState().addCameraWindow(msg.window);
        }
      };
      ws.onclose = () => {
        setStatus("closed");
        if (closed) return;
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 10_000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [qc, setStatus]);
}
