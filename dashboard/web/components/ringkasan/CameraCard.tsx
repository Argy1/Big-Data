"use client";

import Link from "next/link";

import { LevelChip } from "@/components/common/LevelChip";
import { Skeleton } from "@/components/common/States";
import { pct } from "@/components/kamera/format";
import { api } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useCameras } from "@/lib/queries";

/**
 * "Kamera uji · Speed layer". Until the worker runs (Fase 5) the API serves the reference result
 * of notebook 03 (status "reference") and the thumbnail is a still frame of video_uji.mp4.
 */
export function CameraCard() {
  const { data } = useCameras();
  const cam = data?.[0];
  const w = cam?.last;
  const live = cam?.status === "live";

  return (
    <Link
      href="/kamera"
      className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 rounded-panel border border-border bg-panel p-5 text-text no-underline shadow-panel hover:border-border-strong hover:text-text"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-[17px] font-bold">Kamera uji · Speed layer</h2>
        {live ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-lv-3-text">
            <span className="size-2 rounded-full bg-lv-3" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <span className="text-xs font-bold tracking-[0.04em] text-muted" title="Worker speed layer belum berjalan; menampilkan hasil notebook 03">
            HASIL ACUAN
          </span>
        )}
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- live MJPEG stream (or a still frame when no worker runs) */}
        <img
          src={live && cam ? api.streamUrl(cam.id) : "/kamera_frame.jpg"}
          alt="Frame kamera jalan tol dari video uji, dengan kotak deteksi YOLOv8 dan ID tracking pada setiap kendaraan"
          className="block aspect-video w-full bg-overlay-chip object-cover"
        />
        {w && (
          <LevelChip level={w.level_index} solid upper className="absolute top-3 left-3 px-3 py-[5px]">
            {["Lancar", "Melambat", "Padat", "Macet"][w.level_index]} · {fmtNum(w.conf * 100, 1)}%
          </LevelChip>
        )}
      </div>
      {w ? (
        <div className="flex gap-2.5">
          {[
            ["Kecepatan", `${fmtNum(w.features.speed_bl_med, 2)} bl/s`],
            ["Hampir berhenti", pct(w.features.stopped_ratio, 0)],
            ["Okupansi", pct(w.features.occupancy, 0)],
          ].map(([k, v]) => (
            <div key={k} className="flex-1 rounded-[10px] bg-inset px-3 py-2.5">
              <div className="text-[11px] text-muted">{k}</div>
              <div className="mono mt-0.5 text-[15px] font-semibold">{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <Skeleton className="h-14" />
      )}
      <div className="text-[13px] font-semibold text-link">Buka halaman kamera →</div>
    </Link>
  );
}
