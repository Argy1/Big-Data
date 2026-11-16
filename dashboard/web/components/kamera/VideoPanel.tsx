"use client";

import { useEffect, useState } from "react";

import { LEVEL_BG } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { api, type Camera, type CameraWindow } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CLASS_META, mmss, pct, windowKey, windowRange } from "./format";

// Overlays sit on top of video, so they are dark with white text in BOTH themes (PLAN §10.3).
const chip = "rounded-full bg-overlay-chip px-2.5 py-1.5 text-xs font-bold text-white";

function StatusScreen({ cam }: { cam: Camera }) {
  const text: Record<Camera["status"], string> = {
    live: "",
    starting: "Menyiapkan kamera: memuat detektor dan memilih yang paling cocok…",
    queued: cam.note ?? "Menunggu giliran: worker menjalankan maksimal 3 kamera bersamaan.",
    offline: "Worker speed layer belum berjalan untuk kamera ini. Jalankan worker (README) untuk memproses video.",
    reference: "",
    error: `Worker gagal memproses video: ${cam.error ?? "error tidak diketahui"}`,
  };
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-overlay-chip p-6 text-center text-sm text-white">
      {text[cam.status]}
    </div>
  );
}

/** MJPEG <img>; on error (worker restarting, stream idle) it reconnects after 2 s. */
function Stream({ cam }: { cam: Camera }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [cam.id]);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- live MJPEG stream, not an optimisable image
    <img
      key={`${cam.id}-${attempt}`}
      src={`${api.streamUrl(cam.id)}?a=${attempt}`}
      alt={`Video ${cam.name} dengan kotak deteksi YOLOv8 dan nomor ID ByteTrack pada setiap kendaraan`}
      onError={() => setTimeout(() => setAttempt((a) => a + 1), 2000)}
      className="absolute inset-0 block size-full object-contain"
    />
  );
}

export function VideoPanel({
  cam,
  windows,
  current,
  selectedKey,
  onSelect,
}: {
  cam: Camera;
  windows: CameraWindow[];
  current: CameraWindow | null;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const w = cam.width ?? 16;
  const h = cam.height ?? 9;
  const reference = cam.status === "reference";
  const meta = current ? CLASS_META[current.level] : null;
  const shown = windows.slice(-12);

  return (
    <Panel aria-label="Video kamera" className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5 p-4">
      {/* sized to the video's own aspect ratio (portrait videos stay portrait, max 70vh tall) */}
      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl bg-overlay-chip"
        style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(70vh * ${w / h}))` }}
      >
        {cam.status === "live" ? (
          <Stream cam={cam} />
        ) : reference ? (
          // eslint-disable-next-line @next/next/no-img-element -- still frame of video_uji.mp4
          <img
            src="/kamera_frame.jpg"
            alt="Frame contoh video uji jalan tol dengan kotak deteksi YOLOv8 dan ID tracking"
            className="absolute inset-0 block size-full object-cover"
          />
        ) : (
          <StatusScreen cam={cam} />
        )}

        {(cam.status === "live" || reference) && (
          <>
            {/* ROI: the top 35 % is ignored by the features (vehicles too small) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[35%] border-b border-dashed border-white bg-overlay-roi" />
            <span className="pointer-events-none absolute top-[calc(35%-30px)] right-3 hidden rounded-md bg-overlay-chip px-2 py-[3px] text-[11px] text-white sm:block">
              Di luar ROI · objek terlalu kecil
            </span>
            {/* virtual counting line at 70 % of the height (flow_per_min) */}
            <div className="pointer-events-none absolute inset-x-0 top-[70%] border-t-2 border-lv-1" />
            <span className="mono pointer-events-none absolute top-[calc(70%+6px)] left-3 rounded-md bg-lv-1 px-2 py-[3px] text-[11px] font-bold text-on-solid">
              GARIS HITUNG
            </span>
            <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
              {current && meta && (
                <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold tracking-[0.04em] text-on-solid uppercase sm:px-3.5 sm:py-1.5 sm:text-sm", LEVEL_BG[meta.level])}>
                  {meta.label} · {pct(current.conf)}
                </span>
              )}
              {current && <span className={cn(chip, "mono hidden font-normal sm:inline")}>jendela {windowRange(current)}</span>}
            </div>
            <div className="pointer-events-none absolute top-3 right-3 flex flex-col items-end gap-1.5">
              {cam.status === "live" ? (
                <span className={cn(chip, "flex items-center gap-1.5")}>
                  <span className="size-2 rounded-full bg-lv-3" aria-hidden="true" />
                  LIVE · {fmtNum(cam.fps, 0)} fps
                </span>
              ) : (
                <span className={chip}>HASIL ACUAN · notebook 03</span>
              )}
              {cam.device_label && <span className={cn(chip, "mono hidden font-semibold sm:inline")}>{cam.device_label}</span>}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap justify-between gap-2 text-[13px]">
          <span className="font-semibold">Timeline Model A · jendela 5 detik, geser 2,5 detik</span>
          {selectedKey ? (
            <button type="button" onClick={() => onSelect(null)} className="min-h-6 cursor-pointer font-semibold text-link">
              Ikuti jendela terbaru →
            </button>
          ) : (
            <span className="text-muted">Klik jendela untuk melihat fiturnya</span>
          )}
        </div>
        {shown.length ? (
          <>
            <div role="group" aria-label="Jendela waktu" className="flex gap-1">
              {shown.map((x) => {
                const m = CLASS_META[x.level];
                const key = windowKey(x);
                const active = current ? windowKey(current) === key : false;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    aria-label={`Jendela ${windowRange(x)}, ${m.label}`}
                    onClick={() => onSelect(key)}
                    className={cn(
                      "mono min-h-11 min-w-0 flex-1 cursor-pointer rounded-lg border-2 text-[11px] font-bold text-on-solid",
                      LEVEL_BG[m.level],
                      active ? "border-text" : "border-transparent",
                    )}
                  >
                    {mmss(x.t1).replace(/^00:/, "")}
                  </button>
                );
              })}
            </div>
            <div className="mono flex justify-between text-[11px] text-muted">
              <span>{mmss(shown[0].t0)}</span>
              <span>{shown[shown.length - 1].loop > shown[0].loop ? "video berulang" : ""}</span>
              <span>{mmss(shown[shown.length - 1].t1)}</span>
            </div>
          </>
        ) : (
          <div className="rounded-lg bg-inset px-3 py-3 text-[13px] text-muted">Belum ada jendela. Jendela pertama muncul ±5 detik setelah kamera mulai.</div>
        )}
      </div>
    </Panel>
  );
}
