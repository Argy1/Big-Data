import { Panel } from "@/components/common/Panel";
import { cn } from "@/lib/utils";

const LAYERS = [
  {
    name: "BATCH",
    d: "historis, lengkap",
    tag: "text-lv-2-text",
    box: "bg-warn-bg border-batch-line",
    steps: [
      { t: "PEMS-BAY", d: "325 sensor · 5 menit" },
      { t: "Master dataset", d: "Parquet immutable" },
      { t: "Spark batch view", d: "4 view · profil, hotspot" },
      { t: "Model B", d: "LightGBM · +1 & +3 jam" },
    ],
  },
  {
    name: "SPEED",
    d: "real-time, perkiraan",
    tag: "text-lv-0-text",
    box: "bg-speed-bg border-speed-line",
    steps: [
      { t: "Video CCTV", d: "10 fps · 640 px" },
      { t: "YOLOv8 + ByteTrack", d: "deteksi + ID" },
      { t: "Fitur jendela", d: "5 dtk · geser 2,5 dtk" },
      { t: "Model A", d: "Lancar / Padat / Macet" },
    ],
  },
  {
    name: "SERVING",
    d: "gabungan untuk pengguna",
    tag: "text-accent-strong",
    box: "bg-serve-bg border-accent-line",
    steps: [
      { t: "Redis Streams", d: "event real-time" },
      { t: "FastAPI + DuckDB", d: "REST + WebSocket" },
      { t: "Next.js dashboard", d: "peta 3D · grafik · peringatan" },
      { t: "City planner", d: "keputusan & tindakan" },
    ],
  },
];

/** Static diagram of the three Lambda layers (PLAN §2.4). Each row is an ordered list of steps. */
export function LambdaDiagram() {
  return (
    <Panel aria-label="Arsitektur Lambda" className="flex flex-col gap-[18px]">
      <div>
        <h2 className="m-0 text-[17px] font-bold">Arsitektur Lambda di balik dashboard</h2>
        <div className="mt-1 text-[13px] text-muted">Tiga lapisan, satu sumber kebenaran (master dataset)</div>
      </div>
      {LAYERS.map((L) => (
        <div key={L.name} className="flex flex-wrap items-center gap-2.5">
          <div className="w-[130px] flex-none">
            <div className={cn("mono text-xs font-bold", L.tag)}>{L.name}</div>
            <div className="text-xs text-muted">{L.d}</div>
          </div>
          <ol className="m-0 flex min-w-0 flex-[1_1_480px] list-none flex-wrap gap-2.5 p-0" aria-label={`Lapisan ${L.name.toLowerCase()}`}>
            {L.steps.map((s, i) => (
              <li key={s.t} className="flex min-w-0 flex-[1_1_170px] items-center gap-2.5">
                <div className={cn("min-w-0 flex-auto rounded-xl border px-3.5 py-3", L.box)}>
                  <div className="text-sm font-semibold">{s.t}</div>
                  <div className="mono mt-0.5 text-[11px] text-muted">{s.d}</div>
                </div>
                {i < L.steps.length - 1 && (
                  <span aria-hidden="true" className="text-lg text-profile">
                    ›
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </Panel>
  );
}
