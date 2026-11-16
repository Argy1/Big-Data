"""Speed-layer loop for one camera (PLAN §8.4).

frames (10 fps, width 640) -> windows of 5 s every 2.5 s -> extract_features (fresh ByteTrack per
window, exactly like notebook 03) -> Model A -> publish.

Two threads per camera:
  * compute: reads the file as fast as needed and turns each window into (result, annotated frames);
  * player:  plays those frames at the video's real pace and publishes each window result the moment
             its frames start playing, so the stream and the decisions shown are always in sync.
Like the notebook's demo video, the first window plays all its frames, later windows only their
last 2.5 s (the part that is new). The video loops; ByteTrack is reset for every window anyway.
"""

from __future__ import annotations

import contextlib
import logging
import queue
import threading
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from . import features as feat
from .annotate import to_jpeg
from .detector import Detector, choose, detection_scores, load_detectors
from .device import device_label
from .publisher import Publisher
from .video_source import VideoInfo, frames, probe, probe_frames

log = logging.getLogger("arus.worker")

WINDOW_S, STEP_S = 5.0, 2.5  # model_a_config.json
LEVEL_INDEX = {"light": 0, "medium": 2, "heavy": 3}  # by NAME (classes_ order is heavy, light, medium)


@dataclass
class Window:
    payload: dict[str, Any]
    frames: list[np.ndarray]  # annotated frames to play for this window


def classify(model_a: Any, fe: dict[str, float]) -> tuple[str, dict[str, float]]:
    """Model A on one window. Columns come from the fitted pipeline itself (6 features)."""
    cols = list(model_a.feature_names_in_)
    proba = model_a.predict_proba(pd.DataFrame([fe])[cols])[0]
    probs = {str(c): float(p) for c, p in zip(model_a.classes_, proba)}
    return str(model_a.classes_[int(np.argmax(proba))]), probs


def windows(
    frame_iter: Iterator[np.ndarray],
    fps_eff: float,
    get_detector: Callable[[], Detector],
    model_a: Any,
    loop: int = 0,
) -> Iterator[Window]:
    """Slide a 5 s window by 2.5 s over one pass of the video (notebook 03 cell 27)."""
    win, step = int(WINDOW_S * fps_eff), int(STEP_S * fps_eff)
    buf: list[np.ndarray] = []
    s0 = 0
    first = True

    def one(chunk: list[np.ndarray], start: int, first_window: bool) -> Window:
        det = get_detector()
        fe, plots = feat.extract_features(chunk, det.model, det.classes, fps=fps_eff, keep_plots=True)
        level, probs = classify(model_a, fe)
        payload = {
            "loop": loop,
            "t0": round(start / fps_eff, 3),
            "t1": round((start + len(chunk)) / fps_eff, 3),
            "level": level,
            "level_index": LEVEL_INDEX[level],
            "conf": probs[level],
            "probs": probs,
            "features": {k: (None if v is None or (isinstance(v, float) and np.isnan(v)) else round(float(v), 4)) for k, v in fe.items()},
            "det_mean": round(float(fe["det_mean"]), 3),
            "flow_per_min": round(float(fe["flow_per_min"]), 3),
            "detector": det.key,
        }
        return Window(payload, plots if first_window else plots[-step:])

    for f in frame_iter:
        buf.append(f)
        if len(buf) == win:
            yield one(buf, s0, first)
            first = False
            buf = buf[step:]
            s0 += step
    if first and buf:  # video shorter than one window: classify what there is
        yield one(buf, 0, True)


def resolve_source(source: str, data_dir: Path, upload_dir: Path) -> Path:
    """'data:video/video_uji.mp4' or 'uploads:<file>' -> path on this machine (Docker or not)."""
    root, _, rel = source.partition(":")
    base = {"data": data_dir, "uploads": upload_dir}.get(root)
    if base is None or not rel:
        raise ValueError(f"bad camera source: {source!r}")
    return (base / rel).resolve()


def run_offline(path: Path, data_dir: Path, model_a: Any, device: str, mode: str = "auto") -> dict[str, Any]:
    """Process one pass of a video without Redis (used by tests and for checking §12 numbers)."""
    info = probe(path)
    dets = load_detectors(data_dir, device)
    scores = detection_scores(dets, probe_frames(path), device)
    key, reason = choose(mode, scores)
    out = [w.payload for w in windows(frames(path), info.fps_eff, lambda: dets[key], model_a)]
    return {"detector": key, "reason": reason, "scores": scores, "windows": out, "info": info}


class CameraWorker(threading.Thread):
    """Runs one camera until stop() — compute + player threads, state in Redis."""

    def __init__(self, pub: Publisher, data_dir: Path, upload_dir: Path, device: str, model_a: Any):
        super().__init__(name=f"cam-{pub.id}", daemon=True)
        self.pub = pub
        self.data_dir, self.upload_dir = data_dir, upload_dir
        self.device = device
        self.model_a = model_a
        self._stop = threading.Event()
        self.error: str | None = None

    def stop(self) -> None:
        self._stop.set()

    # -------------------------------------------------------------- state helpers
    def _base_state(self, info: VideoInfo, cfg: dict[str, str]) -> dict[str, Any]:
        return {
            "name": cfg.get("name", self.pub.id),
            "device": self.device,
            "device_label": device_label(self.device),
            "width": info.width,
            "height": info.height,
            "fps": round(info.fps_eff, 2),
            "duration_s": round(info.duration_s, 2),
        }

    def run(self) -> None:
        try:
            self._run()
        except Exception as exc:  # noqa: BLE001 - report any crash to the dashboard, the manager restarts us
            log.exception("camera %s crashed", self.pub.id)
            self.error = self.error or f"{type(exc).__name__}: {exc}"
            # Redis itself may be what failed: reporting must not raise a second exception
            with contextlib.suppress(Exception):
                self.pub.state(status="error", error=self.error)

    def _run(self) -> None:
        cfg = self.pub.config()
        path = resolve_source(cfg["source"], self.data_dir, self.upload_dir)
        info = probe(path)
        base = self._base_state(info, cfg)
        self.pub.state(status="starting", **base)

        dets = load_detectors(self.data_dir, self.device)
        scores = detection_scores(dets, probe_frames(path), self.device)
        current = {"mode": None, "key": "coco", "reason": ""}

        def detector() -> Detector:
            # re-read the mode before every window: the dashboard can switch detectors live
            mode = self.pub.config().get("detector_mode", "auto")
            if mode != current["mode"]:
                current["mode"] = mode
                current["key"], current["reason"] = choose(mode, scores)
                log.info("camera %s: detector %s (%s)", self.pub.id, current["key"], current["reason"])
            return dets[current["key"]]

        # maxsize 1: compute stays at most one window ahead of what is playing, so a detector
        # switch from the dashboard shows up within ~5 s
        q: queue.Queue[Window | None] = queue.Queue(maxsize=1)
        player = threading.Thread(target=self._play, args=(q, info, base, scores, current), daemon=True)
        player.start()
        seq = 0
        loop = 0
        while not self._stop.is_set():
            for w in windows(frames(path), info.fps_eff, detector, self.model_a, loop):
                if self._stop.is_set():
                    break
                w.payload["seq"] = seq
                seq += 1
                while not self._stop.is_set():
                    try:
                        q.put(w, timeout=0.5)
                        break
                    except queue.Full:
                        continue
            loop += 1
        if self.error:  # the player died (e.g. Redis dropped): end this worker so the manager restarts it
            raise RuntimeError(self.error)
        with contextlib.suppress(queue.Full):
            q.put(None, timeout=1)
        player.join(timeout=5)

    def _play(self, q: queue.Queue, info: VideoInfo, base: dict, scores: dict, current: dict) -> None:
        try:
            self._play_loop(q, info, base, scores, current)
        except Exception as exc:  # noqa: BLE001 - without this the compute thread would wait on q.put forever
            log.warning("camera %s: player stopped: %s", self.pub.id, exc)
            self.error = f"{type(exc).__name__}: {exc}"
            self._stop.set()

    def _play_loop(self, q: queue.Queue, info: VideoInfo, base: dict, scores: dict, current: dict) -> None:
        interval = 1.0 / info.fps_eff
        nxt = time.monotonic()
        while True:
            w = q.get()
            if w is None or self._stop.is_set():
                return
            w.payload["camera_id"] = self.pub.id
            w.payload["ts"] = datetime.now(UTC).isoformat()
            self.pub.window(w.payload)
            self.pub.state(
                status="live",
                detector_mode=current["mode"],
                detector_active=w.payload["detector"],
                detector_reason=current["reason"],
                det_scores=scores,
                loop=w.payload["loop"],
                **base,
            )
            for f in w.frames:
                if self._stop.is_set():
                    return
                self.pub.frame(to_jpeg(f))
                nxt += interval
                delay = nxt - time.monotonic()
                if delay > 0:
                    time.sleep(delay)
                else:
                    nxt = time.monotonic()  # fell behind (slow CPU): don't try to catch up in a burst
