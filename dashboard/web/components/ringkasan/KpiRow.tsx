"use client";

import Link from "next/link";

import { DeltaChip, KpiCard } from "@/components/common/KpiCard";
import { LevelChip } from "@/components/common/LevelChip";
import { addHours, dayLong, fmtClock, fmtNum, fmtSigned } from "@/lib/format";
import { useCameras, useReplayTs, useSnapshot } from "@/lib/queries";

export function KpiRow() {
  const ts = useReplayTs();
  const { data: snap, isLoading } = useSnapshot(ts);
  const { data: cameras } = useCameras();
  const k = snap?.kpi;
  const loading = isLoading || !k;

  const diff = k?.avg_speed != null && k.normal_speed != null ? k.avg_speed - k.normal_speed : null;
  const pctNow = k ? (k.congested_now / k.n_sensors) * 100 : null;
  const delta1h = k ? k.congested_1h - k.congested_now : 0;

  const cam = cameras?.[0];
  const camLevel = cam?.last?.level_index;
  const activeCams = cameras?.filter((c) => c.status === "live").length ?? 0;

  return (
    <section aria-label="Indikator utama" className="flex flex-wrap gap-4">
      <KpiCard
        label="Kecepatan rata-rata jaringan"
        loading={loading}
        value={fmtNum(k?.avg_speed)}
        unit="km/jam"
        delta={
          k && snap && (
            <>
              <DeltaChip className={diff != null && diff < 0 ? "bg-lv-2-tint text-lv-2-text" : "bg-lv-0-tint text-lv-0-text"}>
                {fmtSigned(diff)}
              </DeltaChip>
              vs normal {dayLong(snap.ts)} {String(k.normal_hour).padStart(2, "0")}:00 ({fmtNum(k.normal_speed)})
            </>
          )
        }
      />
      <KpiCard
        label="Sensor padat/macet sekarang"
        loading={loading}
        value={k?.congested_now}
        unit={`/ ${k?.n_sensors ?? 325} sensor`}
        delta={
          k && (
            <>
              <DeltaChip
                className={
                  pctNow != null && k.normal_congested_pct != null && pctNow > k.normal_congested_pct
                    ? "bg-lv-3-tint text-lv-3-text"
                    : "bg-lv-0-tint text-lv-0-text"
                }
              >
                {fmtNum(pctNow, 0)}%
              </DeltaChip>
              normal jam ini {fmtNum(k.normal_congested_pct)}%
            </>
          )
        }
      />
      <KpiCard
        label="Prediksi padat/macet +1 jam"
        tone="alert"
        loading={loading}
        value={k?.congested_1h}
        valueClassName="text-lv-3-text"
        unit={snap ? `sensor · ${fmtClock(addHours(snap.ts, 1))}` : "sensor"}
        delta={
          k && (
            <>
              <DeltaChip className={delta1h > 0 ? "bg-lv-3-tint text-lv-3-text" : "bg-lv-0-tint text-lv-0-text"}>
                {delta1h > 0 ? "▲" : delta1h < 0 ? "▼" : "="} {Math.abs(delta1h)}
              </DeltaChip>
              {k.worse_1h} memburuk · {k.better_1h} membaik
            </>
          )
        }
      />
      <Link
        href="/kamera"
        className="flex min-w-0 flex-[1_1_210px] flex-col gap-2.5 rounded-panel border border-border bg-panel p-5 text-text no-underline shadow-panel hover:border-border-strong hover:text-text"
      >
        <div className="text-[13px] font-medium text-muted">Kamera aktif · Model A</div>
        <div className="flex items-center gap-2.5">
          <span className="mono text-[38px] leading-[1.2] font-semibold tracking-[-0.03em]">{cameras ? activeCams : "–"}</span>
          {camLevel != null && (
            <LevelChip level={camLevel} solid upper className="px-3 py-1.5 text-[13px]" />
          )}
        </div>
        <div className="text-[13px] text-text-2">
          {cam?.status === "reference"
            ? `Hasil acuan video uji · ±${fmtNum(cam.last?.det_mean, 0)} kendaraan/frame →`
            : cam
              ? `${cam.name} · ±${fmtNum(cam.last?.det_mean, 0)} kendaraan/frame →`
              : "Buka halaman kamera →"}
        </div>
      </Link>
    </section>
  );
}
