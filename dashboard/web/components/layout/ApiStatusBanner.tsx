"use client";

import { API_URL } from "@/lib/api";
import { useReplay } from "@/lib/queries";
import { useUiStore } from "@/store/useUiStore";

/** Shown on every page when the API or its WebSocket is unreachable, so stale panels are never silent. */
export function ApiStatusBanner() {
  const replay = useReplay();
  const ws = useUiStore((s) => s.wsStatus);
  const apiDown = replay.isError;
  const wsDown = !apiDown && ws === "closed";
  if (!apiDown && !wsDown) return null;

  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-alert-line bg-alert-bg px-4 py-3 text-sm">
      <span className="font-bold text-lv-3-text">{apiDown ? "Tidak terhubung ke API" : "Koneksi real-time terputus"}</span>
      <span className="text-text-2">
        {apiDown
          ? `Data tidak bisa dimuat dari ${API_URL}. Pastikan "docker compose up" sedang berjalan.`
          : "Mencoba menyambung ulang… Replay dan kamera tidak diperbarui sampai tersambung."}
      </span>
      {apiDown && (
        <button
          type="button"
          onClick={() => replay.refetch()}
          className="min-h-9 cursor-pointer rounded-lg border border-border-strong bg-panel px-3 text-[13px] font-semibold"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}
