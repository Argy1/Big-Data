"""Read a video file as Model A expects it (PLAN §8.4, notebook 03 cell 26):
~10 fps (keep every `stride`-th frame) and width 640 with the aspect ratio kept (portrait works too).
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

TARGET_FPS = 10
FRAME_WIDTH = 640


@dataclass(frozen=True)
class VideoInfo:
    src_fps: float
    stride: int
    fps_eff: float  # effective fps after striding, e.g. 29.97 / 3 = 9.99
    n_src_frames: int
    width: int  # after resize
    height: int

    @property
    def duration_s(self) -> float:
        return self.n_src_frames / self.src_fps if self.src_fps else 0.0


def probe(path: str | Path) -> VideoInfo:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened() or not cap.read()[0]:
        cap.release()
        # shown on the Kamera page: file name only, no server paths
        raise ValueError(f"video {Path(path).name} tidak bisa dibuka (file rusak atau codec tidak didukung)")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    stride = max(1, round(src_fps / TARGET_FPS))
    s = FRAME_WIDTH / w if w else 1.0
    return VideoInfo(src_fps, stride, src_fps / stride, n, FRAME_WIDTH, round(h * s))


def _resize(f: np.ndarray) -> np.ndarray:
    s = FRAME_WIDTH / f.shape[1]
    return cv2.resize(f, None, fx=s, fy=s)  # same call as notebook 03 (keeps aspect ratio)


def frames(path: str | Path, max_frames: int | None = None) -> Iterator[np.ndarray]:
    """Yield resized frames at ~10 fps from the start of the file (one pass, no looping)."""
    cap = cv2.VideoCapture(str(path))
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    stride = max(1, round(src_fps / TARGET_FPS))
    limit = max_frames
    i = kept = 0
    try:
        while limit is None or kept < limit:
            if i % stride == 0:
                ok, f = cap.read()
                if not ok:
                    break
                kept += 1
                yield _resize(f)
            elif not cap.grab():  # skipped frames: grab only (no colour conversion)
                break
            i += 1
    finally:
        cap.release()


def probe_frames(path: str | Path, n: int = 6, max_seconds: int = 60) -> list[np.ndarray]:
    """n frames spread over the first 60 s (notebook 03 cell 26: at most MAX_SECONDS * TARGET_FPS
    frames, then frames[::len//6][:6])."""
    fr = list(frames(path, max_seconds * TARGET_FPS))
    return fr[:: max(1, len(fr) // n)][:n]
