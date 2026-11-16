"use client";

import { toast } from "sonner";

import { Panel } from "@/components/common/Panel";
import { SegmentedToggle } from "@/components/common/SegmentedToggle";
import type { Camera, DetectorMode } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { useModelMetrics, useSetDetector } from "@/lib/queries";

const OPTIONS: { value: DetectorMode; label: string }[] = [
  { value: "auto", label: "Otomatis" },
  { value: "coco", label: "COCO" },
  { value: "finetuned", label: "Fine-tuned" },
];

/** "Detektor kendaraan": auto / COCO / fine-tuned, with the probe scores that drove the auto pick. */
export function DetectorPicker({ cam }: { cam: Camera }) {
  const set = useSetDetector();
  const { data: metrics } = useModelMetrics();
  const scores = cam.det_scores;
  const active = cam.detector_active === "finetuned" ? "fine-tuned" : cam.detector_active === "coco" ? "COCO" : null;
  const pending = set.isPending;

  const description: Record<DetectorMode, string> = {
    auto:
      (cam.detector_reason ?? "Kedua detektor diuji pada 6 frame; yang mendeteksi lebih banyak kendaraan dipakai.") +
      // state only what the probe measured on THIS video; the domain-shift story depends on the scene
      (active === "COCO"
        ? " COCO mendeteksi lebih banyak kendaraan di video ini, jadi COCO yang dipakai. Di jalan tol bergaya Barat model fine-tuned hampir buta (domain shift)."
        : active === "fine-tuned"
          ? " Model fine-tuned mendeteksi lebih banyak kendaraan di video ini, jadi model itu yang dipakai."
          : ""),
    coco: "YOLOv8s bawaan (COCO): car, motorcycle, bus, truck. Cocok untuk jalan tol dan kamera tinggi bergaya Barat.",
    finetuned: `YOLOv8s fine-tuned Roboflow (7 kelas: motor, mobil, bus, truk, bajaj, becak/sepeda, orang). Cocok untuk lalu lintas campuran ala Indonesia${
      metrics ? `, mAP50 ${fmtNum(metrics.yolo.map50, 3)}` : ""
    }.`,
  };

  const change = (mode: DetectorMode) =>
    set.mutate(
      { id: cam.id, mode },
      {
        onSuccess: () => toast.success("Detektor diganti", { description: "Berlaku mulai jendela berikutnya (±5 detik)." }),
        onError: (e) => toast.error("Gagal mengganti detektor", { description: e.message }),
      },
    );

  return (
    <Panel aria-label="Detektor" className="flex flex-col gap-3.5">
      <h2 className="m-0 text-[17px] font-bold">Detektor kendaraan</h2>
      <SegmentedToggle label="Pilih detektor" options={OPTIONS} value={cam.detector_mode} onChange={change} />
      <div className="flex gap-2.5">
        {[
          { k: "YOLOv8s COCO", v: scores?.coco },
          { k: "Fine-tuned (Roboflow)", v: scores?.finetuned },
        ].map((x) => (
          <div key={x.k} className="flex-1 rounded-[10px] bg-inset p-3">
            <div className="text-[11px] text-muted">{x.k}</div>
            <div className="mono mt-0.5 text-xl font-semibold">{x.v == null ? "–" : fmtNum(x.v, 1)}</div>
            <div className="text-[11px] text-muted">deteksi/frame</div>
          </div>
        ))}
      </div>
      <p className="m-0 text-[13px] leading-[1.55] text-text-2">
        {description[cam.detector_mode]}
        {active && cam.status === "live" && <> Aktif sekarang: <b>{active}</b>.</>}
        {pending && " Menyimpan…"}
      </p>
    </Panel>
  );
}
