"use client";

import Link from "next/link";

import { SensorChart } from "@/components/charts/SensorChart";
import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import { ApiError } from "@/lib/api";
import { fmtNum, fmtReplayTs } from "@/lib/format";
import { useReplayTs, useSensor } from "@/lib/queries";

import { ActionPanel } from "./ActionPanel";
import { ForecastCards } from "./ForecastCards";
import { PerfTable } from "./PerfTable";
import { ReasonPanel } from "./ReasonPanel";
import { SensorPicker } from "./SensorPicker";

const linkBtn =
  "flex h-11 items-center rounded-xl border border-border-strong bg-panel px-4 text-sm font-semibold text-text no-underline hover:border-link hover:text-text";

/** /prediksi/[sensorId] — Model B forecast for one sensor (PLAN §2.3). Follows the replay clock. */
export function PrediksiView({ sensorId }: { sensorId: number }) {
  const ts = useReplayTs();
  const q = useSensor(sensorId, ts);
  const d = q.data;
  // non-numeric ids (/prediksi/abc) never query, so treat them as "not found" too
  const notFound = !Number.isFinite(sensorId) || (q.error instanceof ApiError && q.error.status === 404);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="text-xs font-bold tracking-[0.08em] text-muted uppercase">Model B · prediksi per sensor</div>
          <h1 className="m-0 text-[30px] font-extrabold tracking-[-0.025em]">
            {d ? `${d.name} · ${d.fwy_label}` : notFound ? "Sensor tidak ditemukan" : "Memuat sensor…"}
          </h1>
          <div className="mono text-[13px] text-muted">
            {d && ts
              ? `Sensor #${d.sensor_id} · ${d.lanes} lajur · v_ff ${fmtNum(d.vff_kmh, 0)} km/jam · replay ${fmtReplayTs(ts).replace(" · ", " ")}`
              : "…"}
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-3">
          <SensorPicker sensorId={sensorId} />
          <Link href="/" className={linkBtn}>
            Lihat di peta
          </Link>
        </div>
      </header>

      {notFound ? (
        <Panel>
          <ErrorState message="Sensor ini tidak ada di 325 sensor PEMS-BAY. Pilih sensor lain di atas." />
        </Panel>
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <>
          <ForecastCards data={d} />
          <SensorChart sensorId={sensorId} ts={ts} name={d?.name ?? `#${sensorId}`} />
          <div className="flex flex-wrap items-stretch gap-4">
            <ReasonPanel data={d} />
            {d && ts ? (
              // key: reset the checkboxes when switching sensors
              <ActionPanel key={d.sensor_id} data={d} ts={ts} />
            ) : (
              <Skeleton className="min-h-64 flex-[1_1_320px] rounded-panel" />
            )}
          </div>
          <PerfTable />
        </>
      )}
    </>
  );
}
