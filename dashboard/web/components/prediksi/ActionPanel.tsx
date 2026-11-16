"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/common/Panel";
import type { SensorDetail } from "@/lib/api";
import { fmtClock, fmtReplayTs } from "@/lib/format";
import { isCongested, levelLabel } from "@/lib/levels";
import { useCreateDecision, useDecisions } from "@/lib/queries";

/** Suggested actions; placeholders in [brackets] are filled in by the operator's city (PLAN §2.3). */
function suggestions(d: SensorDetail): string[] {
  return [
    `Kirim peringatan ke petugas lapangan di ruas ${d.fwy_label}`,
    "Tampilkan pesan rute alternatif di papan informasi [LOKASI VMS]",
    "Tinjau waktu siklus lampu di simpang [NAMA SIMPANG]",
  ];
}

/** Shown when the +1 h level is Padat or worse; "Catat keputusan" stores the choice in SQLite. */
export function ActionPanel({ data, ts }: { data: SensorDetail; ts: string }) {
  const [checked, setChecked] = useState<string[]>([]);
  const create = useCreateDecision(data.sensor_id);
  const { data: history } = useDecisions(data.sensor_id);
  const urgent = isCongested(data.h1.level);
  const options = suggestions(data);

  const toggle = (a: string) => setChecked((c) => (c.includes(a) ? c.filter((x) => x !== a) : [...c, a]));

  const submit = () =>
    create.mutate(
      { sensor_id: data.sensor_id, ts, actions: checked },
      {
        onSuccess: () => {
          toast.success("Keputusan dicatat", {
            description: `${checked.length} tindakan untuk ${data.name} · replay ${fmtReplayTs(ts)}`,
          });
          setChecked([]);
        },
        onError: (err) => toast.error("Keputusan gagal dicatat", { description: err.message }),
      },
    );

  if (!urgent) {
    return (
      <Panel aria-label="Tindakan" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3">
        <h2 className="m-0 text-[17px] font-bold">Tindakan yang disarankan</h2>
        <p className="m-0 text-sm leading-relaxed text-text-2">
          Tidak ada tindakan mendesak. Level +1 jam diprediksi{" "}
          <b>{levelLabel(data.h1.level).toLowerCase()}</b>; saran tindakan muncul otomatis saat prediksi ≥ Padat.
        </p>
      </Panel>
    );
  }

  return (
    <Panel tone="alert" aria-label="Tindakan" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">Tindakan yang disarankan</h2>
      <p className="m-0 text-[13px] text-text-2">Muncul otomatis saat level +1 jam ≥ Padat.</p>
      {options.map((a) => (
        <label
          key={a}
          className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-alert-item-line bg-panel p-3 text-sm"
        >
          <input
            type="checkbox"
            checked={checked.includes(a)}
            onChange={() => toggle(a)}
            className="mt-0.5 size-[18px] flex-none cursor-pointer accent-[var(--link)]"
          />
          {a}
        </label>
      ))}
      <button
        type="button"
        onClick={submit}
        disabled={!checked.length || create.isPending}
        aria-describedby="catat-hint"
        className="min-h-11 cursor-pointer rounded-xl bg-accent text-sm font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending ? "Menyimpan…" : "Catat keputusan"}
      </button>
      <p id="catat-hint" className="m-0 text-xs text-muted">
        {checked.length ? `${checked.length} tindakan dipilih.` : "Pilih minimal satu tindakan."}
        {history && history.length > 0 && (
          <>
            {" "}
            {/* created_at is a real UTC timestamp (not replay time): show it in the viewer's local time */}
            {history.length} keputusan tercatat untuk sensor ini, terakhir dicatat pukul{" "}
            {fmtClock(new Date(history[0].created_at))} waktu nyata, bukan waktu replay ({history[0].actions.length} tindakan).
          </>
        )}
      </p>
    </Panel>
  );
}
