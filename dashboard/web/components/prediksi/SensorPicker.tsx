"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useAlerts, useMetaSensors, useReplayTs } from "@/lib/queries";

/** Native <select>: current early-warning sensors first, then every sensor by name. */
export function SensorPicker({ sensorId }: { sensorId: number }) {
  const router = useRouter();
  const ts = useReplayTs();
  const { data: sensors } = useMetaSensors();
  const { data: alerts } = useAlerts(ts);

  const all = useMemo(
    () => [...(sensors ?? [])].sort((a, b) => a.name.localeCompare(b.name, "id") || a.sensor_id - b.sensor_id),
    [sensors],
  );
  const known = all.some((s) => s.sensor_id === sensorId);

  return (
    <>
      <label className="sr-only" htmlFor="pilih-sensor">
        Pilih sensor
      </label>
      <select
        id="pilih-sensor"
        value={known ? sensorId : ""}
        onChange={(e) => router.push(`/prediksi/${e.target.value}`)}
        className="h-11 max-w-full min-w-0 cursor-pointer rounded-xl border border-border-strong bg-panel px-3.5 text-sm text-text sm:max-w-[340px]"
      >
        {!known && <option value="">Pilih sensor…</option>}
        {alerts && alerts.length > 0 && (
          <optgroup label="Peringatan dini · 1 jam">
            {alerts.map((a) => (
              <option key={`a-${a.sensor_id}`} value={a.sensor_id}>
                {a.sensor_id} · {a.name} ({a.fwy_label})
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Semua sensor">
          {all.map((s) => (
            <option key={s.sensor_id} value={s.sensor_id}>
              {s.sensor_id} · {s.name} ({s.fwy_label})
            </option>
          ))}
        </optgroup>
      </select>
    </>
  );
}
