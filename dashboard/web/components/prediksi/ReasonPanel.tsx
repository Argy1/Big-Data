"use client";

import { LEVEL_TEXT } from "@/components/common/LevelChip";
import { Panel } from "@/components/common/Panel";
import { Skeleton } from "@/components/common/States";
import type { SensorDetail } from "@/lib/api";
import { featureLabel } from "@/lib/features";
import { dayLong, fmtNum } from "@/lib/format";
import { isCongested, levelLabel } from "@/lib/levels";
import { useModelMetrics } from "@/lib/queries";

/** Plain-language explanation: the normal speed at the target hour + the model's top features. */
function explanation(d: SensorDetail) {
  const { now, h1 } = d;
  const day = dayLong(h1.ts);
  const hour = `${h1.ts.slice(11, 13)}:00`;
  const nowBad = isCongested(now.level);
  const nextBad = isCongested(h1.level);
  const prof = (
    <span className={`mono font-semibold ${h1.level != null ? LEVEL_TEXT[h1.level] : ""}`}>{fmtNum(h1.profile)} km/jam</span>
  );

  if (!nowBad && nextBad)
    return (
      <>
        Normalnya, pada hari {day} pukul {hour} sensor ini hanya {prof}. Sekarang masih {levelLabel(now.level).toLowerCase()},
        tetapi Model B membaca pola rutin, kondisi terkini, dan sensor tetangganya, lalu memperkirakan antrean akan
        terbentuk seperti biasa pada jam itu.
      </>
    );
  if (nowBad && nextBad)
    return (
      <>
        Sensor ini sudah {levelLabel(now.level).toLowerCase()} sekarang, dan normalnya pada hari {day} pukul {hour} kecepatannya
        sekitar {prof}. Model B memperkirakan kemacetan belum akan reda dalam 1 jam.
      </>
    );
  if (nowBad && !nextBad)
    return (
      <>
        Sekarang {levelLabel(now.level).toLowerCase()}, tetapi normalnya pada hari {day} pukul {hour} kecepatannya kembali
        ke sekitar {prof}. Model B memperkirakan kondisi membaik dalam 1 jam.
      </>
    );
  return (
    <>
      Normalnya, pada hari {day} pukul {hour} kecepatan sensor ini sekitar {prof}, dan kondisi sekarang juga tidak
      menyimpang jauh dari pola itu. Model B tidak melihat tanda kemacetan dalam 1 jam.
    </>
  );
}

export function ReasonPanel({ data }: { data: SensorDetail | undefined }) {
  const { data: metrics } = useModelMetrics();
  // top 5 by gain, straight from model_b_1h.joblib (PLAN §6 — not hard-coded)
  const top = metrics?.importance_1h.slice(0, 5) ?? [];
  const max = top[0]?.gain ?? 1;
  const verdict = data?.h1.level != null ? levelLabel(data.h1.level).toLowerCase() : "…";

  return (
    <Panel aria-label="Alasan prediksi" className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">Kenapa diprediksi {verdict}?</h2>
      {data ? (
        <p className="m-0 text-sm leading-relaxed text-text-2">{explanation(data)}</p>
      ) : (
        <Skeleton className="h-20" />
      )}
      <div className="text-xs font-bold tracking-[0.06em] text-muted uppercase">Fitur terpenting model (gain)</div>
      {top.length ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {top.map((f) => (
            <li key={f.feature} className="flex items-center gap-2.5 text-[13px]">
              <span className="mono w-[110px] flex-none text-text-2">{f.feature}</span>
              <div
                className="h-2 flex-auto rounded bg-track"
                role="img"
                aria-label={`${f.feature}: ${fmtNum(f.gain * 100, 1)}% gain`}
              >
                <div className="h-2 rounded bg-accent" style={{ width: `${(f.gain / max) * 100}%` }} />
              </div>
              <span className="mono w-10 flex-none text-right text-xs text-text-2">{fmtNum(f.gain, 2)}</span>
              <span className="hidden w-[150px] flex-none text-xs text-muted sm:inline">{featureLabel(f.feature)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Skeleton className="h-32" />
      )}
    </Panel>
  );
}
