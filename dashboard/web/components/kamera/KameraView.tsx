"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorState, Skeleton } from "@/components/common/States";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCameras, useCameraWindows, useUploadCamera } from "@/lib/queries";
import { useUiStore } from "@/store/useUiStore";

import { DecisionPanel } from "./DecisionPanel";
import { DetectorPicker } from "./DetectorPicker";
import { FeatureBars } from "./FeatureBars";
import { windowKey } from "./format";
import { VideoPanel } from "./VideoPanel";

const MAX_UPLOAD_MB = 300;
const STATUS_LABEL = { live: "live", starting: "menyiapkan", queued: "antre", offline: "offline", reference: "hasil acuan", error: "error" };

/** /kamera — speed layer: annotated stream + Model A decisions (PLAN §2.2). */
export function KameraView() {
  const cams = useCameras();
  const upload = useUploadCamera();
  const fileRef = useRef<HTMLInputElement>(null);
  const { selectedCamera, setSelectedCamera } = useUiStore();
  const [selectedWindow, setSelectedWindow] = useState<string | null>(null); // null = follow the newest

  const list = cams.data ?? [];
  const cam = list.find((c) => c.id === selectedCamera) ?? list[0] ?? null;
  const windows = useCameraWindows(cam?.id ?? null);
  const current = useMemo(
    () => (selectedWindow ? windows.find((w) => windowKey(w) === selectedWindow) : undefined) ?? windows[windows.length - 1] ?? cam?.last ?? null,
    [windows, selectedWindow, cam],
  );

  useEffect(() => setSelectedWindow(null), [cam?.id]);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error("Video terlalu besar", { description: `Maksimal ${MAX_UPLOAD_MB} MB.` });
      return;
    }
    const id = toast.loading(`Mengunggah ${file.name}…`);
    upload.mutate(
      { file, name: `Unggahan · ${file.name.replace(/\.[^.]+$/, "")}` },
      {
        onSuccess: (c) => {
          toast.success(`Kamera ${c.id} ditambahkan`, { id, description: "Worker mulai memprosesnya dalam beberapa detik." });
          setSelectedCamera(c.id);
        },
        onError: (e) => toast.error("Unggah gagal", { id, description: e.message }),
        onSettled: () => {
          if (fileRef.current) fileRef.current.value = "";
        },
      },
    );
  };

  return (
    <>
      <PageHeader eyebrow="Speed layer · Model A (nowcast)" title="Kamera live">
        <div className="flex max-w-full flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="pilih-kamera">
            Pilih kamera
          </label>
          <select
            id="pilih-kamera"
            value={cam?.id ?? ""}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="h-11 max-w-full min-w-0 cursor-pointer rounded-xl border border-border-strong bg-panel px-3.5 text-sm text-text sm:max-w-[360px]"
          >
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {/* status before the (long) name, so a narrow select never cuts it off */}
                {c.id} · {STATUS_LABEL[c.status]} · {c.name}
              </option>
            ))}
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,.mp4,.m4v,.mov"
            className="sr-only"
            id="unggah-video"
            // opened by the "Unggah video" button; kept out of the Tab order so focus lands on the button
            aria-label="Pilih file video (.mp4) untuk diunggah"
            tabIndex={-1}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-accent px-[18px] text-sm font-bold text-on-accent disabled:cursor-wait disabled:opacity-60"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
            </svg>
            {upload.isPending ? "Mengunggah…" : "Unggah video"}
          </button>
        </div>
      </PageHeader>

      {cams.isError ? (
        <ErrorState onRetry={() => cams.refetch()} />
      ) : !cam ? (
        <Skeleton className="h-[480px] rounded-panel" />
      ) : (
        <>
          <div className="flex flex-wrap items-stretch gap-4">
            <VideoPanel cam={cam} windows={windows} current={current} selectedKey={selectedWindow} onSelect={setSelectedWindow} />
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
              <DecisionPanel current={current} />
              <DetectorPicker cam={cam} />
            </div>
          </div>
          <FeatureBars current={current} />
        </>
      )}
    </>
  );
}
