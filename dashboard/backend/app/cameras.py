"""Camera registry (SQLite) mirrored to Redis for the worker, plus reading what the worker publishes.
Redis keys are documented in worker/speed_layer/publisher.py.
"""

from __future__ import annotations

import json
import logging
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
import redis.asyncio as aioredis

from .db import Camera, Session, select
from .levels import CAMERA_TO_INDEX

log = logging.getLogger("arus.cameras")

DEFAULT_CAMERA = Camera(
    id="CAM-01",
    name="Kamera uji · jalan tol (video_uji.mp4)",
    source="data:video/video_uji.mp4",
    detector_mode="auto",
)
DETECTOR_MODES = ("auto", "coco", "finetuned")
FEATURES = ["speed_bl_med", "speed_bl_p25", "stopped_ratio", "occupancy", "track_len_ratio", "optflow_bl"]
LIVE_FRESH_S = 15  # a camera is "live" while the worker refreshed its state within this many seconds


def seed(engine) -> None:
    with Session(engine) as s:
        if s.get(Camera, DEFAULT_CAMERA.id) is None:
            s.add(Camera(**DEFAULT_CAMERA.model_dump()))
            s.commit()


def all_cameras(engine) -> list[Camera]:
    with Session(engine) as s:
        return list(s.exec(select(Camera).order_by(Camera.id)).all())


def next_id(engine) -> str:
    nums = [int(c.id.split("-")[1]) for c in all_cameras(engine) if c.id.startswith("CAM-")]
    return f"CAM-{(max(nums) + 1 if nums else 1):02d}"


async def mirror(r: aioredis.Redis, cams: list[Camera]) -> None:
    """Write the camera list + config the worker follows (idempotent; also re-run periodically)."""
    pipe = r.pipeline()
    pipe.delete("cam:ids")
    if cams:
        pipe.sadd("cam:ids", *[c.id for c in cams])
    for c in cams:
        pipe.hset(f"cam:cfg:{c.id}", mapping={"name": c.name, "source": c.source, "detector_mode": c.detector_mode})
    await pipe.execute()


def _decode(h: dict) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in h.items():
        k = k.decode() if isinstance(k, bytes) else k
        v = v.decode() if isinstance(v, bytes) else v
        if k in ("det_scores",):
            v = json.loads(v)
        elif k in ("width", "height", "loop"):
            v = int(float(v))
        elif k in ("fps", "duration_s", "updated"):
            v = float(v)
        out[k] = v
    return out


async def state(r: aioredis.Redis, cam_id: str) -> dict[str, Any]:
    h = _decode(await r.hgetall(f"cam:state:{cam_id}"))
    if not h:
        return {"status": "offline"}
    if h.get("status") == "live" and time.time() - h.get("updated", 0) > LIVE_FRESH_S:
        h["status"] = "offline"
    return h


async def windows(r: aioredis.Redis, cam_id: str, limit: int) -> list[dict[str, Any]]:
    entries = await r.xrevrange(f"camera:{cam_id}", count=limit)
    return [json.loads(fields[b"data"]) for _, fields in reversed(entries)]


@lru_cache(maxsize=1)
def reference_timeline(path: Path) -> list[dict[str, Any]]:
    """Notebook 03's result on video_uji.mp4 — shown for CAM-01 while no worker runs, clearly marked."""
    df = pd.read_csv(path)
    out = []
    for i, r in enumerate(df.itertuples(index=False)):
        probs = {"light": float(r.p_light), "medium": float(r.p_medium), "heavy": float(r.p_heavy)}
        out.append({
            "camera_id": DEFAULT_CAMERA.id,
            "seq": i,
            "loop": 0,
            "t0": float(r.t_start),
            "t1": float(r.t_end),
            "level": r.level,
            "level_index": CAMERA_TO_INDEX[r.level],
            "conf": probs[r.level],
            "probs": probs,
            "features": {f: float(getattr(r, f)) for f in [*FEATURES, "det_mean", "tracks_per_s", "flow_per_min"]},
            "det_mean": float(r.det_mean),
            "flow_per_min": float(r.flow_per_min),
            "detector": "coco",
            "source": "reference",
        })
    return out


def resolve_upload(upload_dir: Path, source: str) -> Path | None:
    root, _, rel = source.partition(":")
    return (upload_dir / rel) if root == "uploads" else None
