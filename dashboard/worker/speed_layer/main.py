"""Worker entry point: runs every camera listed in Redis `cam:ids` (max MAX_CAMERAS at once).

    uv run python -m speed_layer.main            (from dashboard/worker)

The API owns the camera list (SQLite) and mirrors it to Redis; this process just follows it: new ids
start a CameraWorker, removed ids stop, crashed cameras restart after a short back-off.
"""

from __future__ import annotations

import contextlib
import logging
import os
import time
import warnings
from pathlib import Path

import joblib
import redis

from .device import device_label, pick_device
from .publisher import Publisher
from .run_camera import CameraWorker

log = logging.getLogger("arus.worker")

DASHBOARD = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR") or DASHBOARD / "data").resolve()
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR") or DASHBOARD / "appdata" / "uploads").resolve()
REDIS_URL = os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
MAX_CAMERAS = int(os.environ.get("MAX_CAMERAS") or 3)
POLL_S = 2.0
RESTART_BACKOFF_S = 10.0


def load_model_a():
    # our own notebook-03 output (trusted pickle); versions pinned to Colab, so no warning expected
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model = joblib.load(DATA_DIR / "model_a" / "model_a.joblib")
    for w in caught:
        log.warning("model_a: %s", w.message)
    return model


def connect() -> redis.Redis:
    while True:
        try:
            r = redis.Redis.from_url(REDIS_URL)
            r.ping()
            return r
        except redis.ConnectionError:
            log.warning("Redis %s belum siap, coba lagi…", REDIS_URL)
            time.sleep(2)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    device = pick_device()
    log.info("device %s (%s) · data %s · uploads %s", device, device_label(device), DATA_DIR, UPLOAD_DIR)
    model_a = load_model_a()
    r = connect()
    running: dict[str, CameraWorker] = {}
    failed_at: dict[str, float] = {}

    while True:
        try:
            wanted = sorted(x.decode() for x in r.smembers("cam:ids"))
        except (redis.ConnectionError, redis.TimeoutError):
            # Redis restarted or briefly unreachable: keep the process alive and wait for it.
            # Camera threads fail on their own; the dead ones restart below once Redis is back.
            log.warning("Redis terputus, menunggu tersambung lagi…")
            time.sleep(POLL_S)
            r = connect()
            continue
        for cid in list(running):
            if cid not in wanted:
                log.info("stop camera %s", cid)
                running.pop(cid).stop()
        for cid, w in list(running.items()):
            if not w.is_alive():
                running.pop(cid)
                failed_at[cid] = time.time()
        for cid in wanted:
            if cid in running:
                continue
            if len(running) >= MAX_CAMERAS:
                with contextlib.suppress(redis.ConnectionError):
                    Publisher(r, cid).state(status="queued", note=f"maksimal {MAX_CAMERAS} kamera bersamaan")
                continue
            if time.time() - failed_at.get(cid, 0) < RESTART_BACKOFF_S:
                continue
            log.info("start camera %s", cid)
            w = CameraWorker(Publisher(r, cid), DATA_DIR, UPLOAD_DIR, device, model_a)
            w.start()
            running[cid] = w
        time.sleep(POLL_S)


if __name__ == "__main__":
    main()
