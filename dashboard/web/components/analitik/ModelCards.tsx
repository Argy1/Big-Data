"use client";

import { ErrorState, Skeleton } from "@/components/common/States";
import type { ModelMetrics } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useModelMetrics } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Card {
  tag: string;
  name: string;
  desc: string;
  top: string; // top border colour (class)
  tagColor: string;
  kpis: { k: string; v: string; unit?: string }[];
  note: string;
}

const CLASS_ID: Record<string, string> = {
  motorcycle: "motor",
  car: "mobil",
  bus: "bus",
  truck: "truk",
  auto_rickshaw: "bajaj",
  nonmotorized: "nonmotor",
  person: "orang",
};

/** Every number comes from /api/models/metrics, i.e. the notebook outputs (PLAN §2.4: no hard-coding). */
function cards(m: ModelMetrics): Card[] {
  const weakest = [...m.yolo.per_class].sort((a, b) => a.mAP50 - b.mAP50)[0];
  const rf = m.model_a.cv_results["Random Forest"];
  const base1 = m.model_a.cv_results["Baseline 1 fitur (kecepatan)"];
  const t = (h: string, method: string) =>
    m.model_b.test_metrics.find((x) => x.horizon === h && x.subset === "Semua" && x.method === method)!;
  const b1 = t("1h", "Model B");
  const b3 = t("3h", "Model B");

  return [
    {
      tag: "SPEED LAYER · DETEKSI",
      name: "YOLOv8s fine-tuned",
      desc: `Roboflow · ${m.yolo.classes.length} kelas lalu lintas campuran`,
      top: "border-t-link",
      tagColor: "text-accent-strong",
      kpis: [
        { k: "mAP50", v: fmtNum(m.yolo.map50, 3) },
        { k: "Recall", v: fmtNum(m.yolo.recall, 3) },
      ],
      note: `Kelas terlemah: ${CLASS_ID[weakest.kelas] ?? weakest.kelas} (mAP50 ${fmtNum(weakest.mAP50, 3)}). Gagal di jalan tol Barat (domain shift), jadi detektor dipilih per kamera.`,
    },
    {
      tag: "SPEED LAYER · NOWCAST",
      name: `Model A · ${m.model_a.model}`,
      desc: `UCSD ${m.model_a.n_clips} klip · 4 split resmi`,
      top: "border-t-lv-0",
      tagColor: "text-lv-0-text",
      kpis: [
        { k: "Akurasi", v: `${fmtNum(rf.accuracy * 100, 1)}%` },
        { k: "Macro-F1", v: fmtNum(rf.macro_f1, 3) },
      ],
      note: base1
        ? `Mengalahkan baseline 1 fitur kecepatan (${fmtNum(base1.accuracy * 100, 1)}%). Fitur bebas kalibrasi kamera: kecepatan dalam panjang-kendaraan/detik.`
        : "Fitur bebas kalibrasi kamera: kecepatan dalam panjang-kendaraan/detik.",
    },
    {
      tag: "BATCH LAYER · FORECAST",
      name: "Model B · LightGBM",
      desc: "PEMS-BAY · uji Juni 2017",
      top: "border-t-lv-2",
      tagColor: "text-lv-2-text",
      kpis: [
        { k: "MAE 1 jam", v: fmtNum(b1.mae_kmh, 2), unit: "km/j" },
        { k: "Recall macet", v: fmtNum(b1.recall_congested, 3) },
      ],
      note:
        `Persistence ${fmtNum(t("1h", "Persistence").mae_kmh, 2)} km/j, profil ${fmtNum(t("1h", "Profil historis").mae_kmh, 2)} km/j. ` +
        `Horizon 3 jam: MAE ${fmtNum(b3.mae_kmh, 2)} km/j, recall macet ${fmtNum(b3.recall_congested, 3)}.` +
        (m.model_b.weather ? " Fitur cuaca Open-Meteo dipakai." : ""),
    },
  ];
}

export function ModelCards() {
  const q = useModelMetrics();
  return (
    <section aria-label="Kinerja model" className="flex flex-col gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">Kinerja ketiga model</h2>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <div className="flex flex-wrap gap-4">
          {q.data
            ? cards(q.data).map((c) => (
                <article
                  key={c.name}
                  className={cn(
                    "flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-panel border border-t-4 border-border bg-panel p-5 shadow-panel",
                    c.top,
                  )}
                >
                  <div>
                    <div className={cn("mono text-xs font-bold", c.tagColor)}>{c.tag}</div>
                    <h3 className="m-0 mt-1 text-lg font-bold">{c.name}</h3>
                    <div className="mt-0.5 text-[13px] text-muted">{c.desc}</div>
                  </div>
                  <div className="flex gap-2.5">
                    {c.kpis.map((k) => (
                      <div key={k.k} className="flex-1 rounded-[10px] border border-track bg-inset p-3">
                        <div className="text-[11px] text-muted">{k.k}</div>
                        <div className="mono mt-0.5 text-[22px] font-semibold whitespace-nowrap">
                          {k.v}
                          {k.unit && <span className="ml-1 text-xs font-medium text-muted">{k.unit}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="m-0 text-[13px] leading-[1.55] text-text-2">{c.note}</p>
                </article>
              ))
            : Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64 min-w-0 flex-[1_1_280px] rounded-panel" />)}
        </div>
      )}
    </section>
  );
}
