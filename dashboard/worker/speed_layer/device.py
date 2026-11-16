"""Pick the inference device (PLAN §3.1): cuda:0 when available, overridable via WORKER_DEVICE."""

from __future__ import annotations

import os

import torch


def pick_device() -> str:
    forced = os.environ.get("WORKER_DEVICE", "").strip()
    if forced:
        return forced
    return "cuda:0" if torch.cuda.is_available() else "cpu"


def device_label(device: str) -> str:
    """Short label for the UI chip, e.g. 'GPU · RTX 5050' or 'CPU'."""
    if device.startswith("cuda") and torch.cuda.is_available():
        name = torch.cuda.get_device_name(torch.device(device))
        for prefix in ("NVIDIA GeForce ", "NVIDIA "):
            name = name.removeprefix(prefix)
        return f"GPU · {name.removesuffix(' Laptop GPU')}"
    return "CPU"
