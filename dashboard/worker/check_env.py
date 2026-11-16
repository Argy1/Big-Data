"""Fase 0 sanity check for the worker environment.

- torch is the +cu128 build and sees the GPU
- model_a.joblib loads without a version warning
- both YOLO detectors load (downloads COCO yolov8s.pt into data/yolo/ on first run)

Usage (from dashboard/worker/):  uv run python check_env.py
"""

from __future__ import annotations

import os
import sys
import warnings
from pathlib import Path

import joblib
import torch

from speed_layer.device import device_label, pick_device

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data")).resolve()


def main() -> int:
    ok = True
    cuda = torch.cuda.is_available()
    print(f"torch {torch.__version__}  cuda={cuda}  "
          f"gpu={torch.cuda.get_device_name(0) if cuda else '-'}")
    if "+cu128" not in torch.__version__:
        print("  PERINGATAN: bukan wheel +cu128 (PLAN §3.1)")
        ok = False

    device = pick_device()
    print(f"device: {device}  ({device_label(device)})")

    # model_a.joblib is our own Colab output (trusted); joblib = pickle, never load uploads.
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model = joblib.load(DATA_DIR / "model_a" / "model_a.joblib")
    print(f"model_a: {type(model).__name__}, classes={list(model.classes_)}, warnings={len(caught)}")
    for w in caught:
        print(f"  {w.category.__name__}: {w.message}")
    ok &= not caught

    from ultralytics import YOLO

    yolo_dir = DATA_DIR / "yolo"
    coco_path = yolo_dir / "yolov8s.pt"
    if not coco_path.is_file():
        # Ultralytics downloads into the CWD; run from yolo_dir so the file lands there.
        cwd = Path.cwd()
        os.chdir(yolo_dir)
        try:
            YOLO("yolov8s.pt")
        finally:
            os.chdir(cwd)
    for name in ("yolov8s.pt", "yolov8s_traffic7.pt"):
        det = YOLO(str(yolo_dir / name))
        det.to(device)
        print(f"{name}: {len(det.names)} kelas, device={next(det.model.parameters()).device}")

    print("OK" if ok else "ADA MASALAH")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
