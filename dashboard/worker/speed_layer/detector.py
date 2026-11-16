"""Load both detectors and pick one per camera (PLAN §8.4).

COCO yolov8s.pt sees western freeways; the Roboflow fine-tune (notebook 02) sees mixed South-Asian
traffic but is almost blind on US freeways (domain shift). "auto" runs both on 6 probe frames and keeps
the one that finds more vehicles, like notebook 03 cell 26.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from ultralytics import YOLO

COCO_VEH = [2, 3, 5, 7]  # car, motorcycle, bus, truck
PROBE_CONF = 0.25  # notebook 03 cells 10 & 26 use 0.25 for the detector comparison


@dataclass
class Detector:
    key: str  # "coco" | "finetuned"
    label: str
    model: YOLO
    classes: list[int]


def load_detectors(data_dir: Path, device: str) -> dict[str, Detector]:
    """Fresh model instances (one set per camera: YOLO trackers keep per-instance state)."""
    coco = YOLO(str(data_dir / "yolo" / "yolov8s.pt"))
    ft = YOLO(str(data_dir / "yolo" / "yolov8s_traffic7.pt"))
    for m in (coco, ft):
        m.to(device)
    return {
        "coco": Detector("coco", "COCO", coco, COCO_VEH),
        "finetuned": Detector("finetuned", "fine-tuned", ft, [i for i, n in ft.names.items() if n != "person"]),
    }


def detection_scores(dets: dict[str, Detector], probe: list[np.ndarray], device: str) -> dict[str, float]:
    """Mean detections per probe frame for each detector."""
    return {
        k: float(np.mean([len(d.model.predict(f, imgsz=640, conf=PROBE_CONF, classes=d.classes, verbose=False, device=device)[0].boxes) for f in probe]))
        if probe
        else 0.0
        for k, d in dets.items()
    }


def fmt1(v: float) -> str:
    return f"{v:.1f}".replace(".", ",")


def choose(mode: str, scores: dict[str, float]) -> tuple[str, str]:
    """(detector key, Indonesian reason shown in the UI)."""
    s = f"COCO {fmt1(scores['coco'])} vs fine-tuned {fmt1(scores['finetuned'])} deteksi/frame"
    if mode in ("coco", "finetuned"):
        return mode, f"Dipilih manual. Uji 6 frame: {s}."
    best = max(scores, key=scores.get)
    return best, f"Dipilih otomatis: {s}."
