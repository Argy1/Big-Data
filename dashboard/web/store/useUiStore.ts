import { create } from "zustand";

import type { CameraWindow, Horizon } from "@/lib/api";

export type MapView = "3d" | "2d";
export type WsStatus = "connecting" | "open" | "closed";

/** Live camera windows kept per camera (PLAN §8.3: at most 40). */
export const MAX_CAMERA_WINDOWS = 40;

interface UiState {
  horizon: Horizon;
  mapView: MapView;
  wsStatus: WsStatus;
  selectedCamera: string | null;
  cameraWindows: Record<string, CameraWindow[]>;
  setHorizon: (h: Horizon) => void;
  setMapView: (v: MapView) => void;
  setWsStatus: (s: WsStatus) => void;
  setSelectedCamera: (id: string) => void;
  addCameraWindow: (w: CameraWindow) => void;
}

export const useUiStore = create<UiState>((set) => ({
  horizon: 0,
  mapView: "3d", // 3D is the default map (PLAN §11)
  wsStatus: "connecting",
  selectedCamera: null,
  cameraWindows: {},
  setHorizon: (horizon) => set({ horizon }),
  setMapView: (mapView) => set({ mapView }),
  setWsStatus: (wsStatus) => set({ wsStatus }),
  setSelectedCamera: (selectedCamera) => set({ selectedCamera }),
  addCameraWindow: (w) =>
    set((s) => {
      const prev = s.cameraWindows[w.camera_id] ?? [];
      if (prev.some((p) => p.seq === w.seq)) return s;
      return { cameraWindows: { ...s.cameraWindows, [w.camera_id]: [...prev, w].slice(-MAX_CAMERA_WINDOWS) } };
    }),
}));
