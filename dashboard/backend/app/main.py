"""Arus API (serving layer)."""

from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime

import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from . import cameras as camera_store
from . import queries
from .config import REQUIRED_DIRS, REQUIRED_FILES, settings
from .context import AppContext
from .db import Batch, make_engine
from .model_store import load_all
from .refdata import load_refdata
from .replay import ReplayClock
from .routers import analytics, cameras, decisions, meta, models, network, replay, sensors
from .ws import ConnectionManager

log = logging.getLogger("arus")


def check_data() -> list[str]:
    """Return the required data paths that are missing (empty list = data OK)."""
    d = settings.data_dir
    missing = [f for f in REQUIRED_FILES if not (d / f).is_file()]
    missing += [p for p in REQUIRED_DIRS if not any((d / p).rglob("*.parquet"))]
    return missing


def build_context() -> AppContext:
    loaded = load_all(settings.data_dir)
    batch = Batch(settings.data_dir)
    ref = load_refdata(settings.data_dir, batch, {k: r.model for k, r in loaded.items()})
    manager = ConnectionManager()

    async def on_tick(ts: datetime) -> None:
        kpi = await asyncio.to_thread(queries.kpi_at, batch, ref, ts)
        await manager.broadcast({"type": "tick", "ts": ts, "kpi": kpi})

    async def on_state(running: bool) -> None:
        await manager.broadcast({"type": "replay", **clock.state()})

    clock = ReplayClock(settings.replay_start, ref.min_ts, ref.max_ts, settings.tick_seconds, on_tick, on_state)
    return AppContext(batch=batch, ref=ref, replay=clock, ws=manager, engine=make_engine(settings.app_db), models=loaded)


MIRROR_EVERY_S = 10


async def mirror_cameras(app: FastAPI) -> None:
    """Keep the worker's camera list in Redis in sync with SQLite (also after a Redis restart)."""
    ctx: AppContext = app.state.ctx
    while True:
        try:
            await camera_store.mirror(app.state.redis, camera_store.all_cameras(ctx.engine))
        except Exception as exc:  # noqa: BLE001 - Redis down: try again later
            log.debug("camera mirror: %s", exc)
        await asyncio.sleep(MIRROR_EVERY_S)


FORWARD_POLL_S = 0.3


async def forward_camera_windows(app: FastAPI) -> None:
    """Redis `camera:{id}` streams -> WebSocket {"type": "camera", …} (PLAN §8.1).

    Non-blocking XREAD polled every 0,3 s (windows arrive every 2,5 s): a blocking XREAD would hold
    a pooled connection for the whole wait and freezes the loop with the fake Redis used in tests.
    """
    ctx: AppContext = app.state.ctx
    last: dict[str, str | bytes] = {}
    while True:
        try:
            r = app.state.redis  # read each time: tests swap in a fake Redis
            for c in camera_store.all_cameras(ctx.engine):
                key = f"camera:{c.id}"
                if key not in last:  # start after the newest existing entry: only forward new windows
                    newest = await r.xrevrange(key, count=1)
                    last[key] = newest[0][0] if newest else "0-0"
            resp = await r.xread(last, count=50)
            await asyncio.sleep(FORWARD_POLL_S)
            for key, entries in resp or []:
                for entry_id, fields in entries:
                    last[key.decode()] = entry_id
                    w = json.loads(fields[b"data"])
                    await ctx.ws.broadcast({
                        "type": "camera",
                        "camera_id": w["camera_id"],
                        "window": w,
                        "level": w["level"],
                        "probs": w["probs"],
                        "features": w["features"],
                    })
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - Redis down: retry, the dashboard shows "offline"
            log.debug("camera forwarder: %s", exc)
            await asyncio.sleep(2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(settings.redis_url, socket_connect_timeout=1)
    app.state.ctx = None
    tasks: list[asyncio.Task] = []
    if missing := check_data():
        log.error("data tidak lengkap, jalankan scripts/copy_data.py: %s", missing)
    else:
        app.state.ctx = build_context()
        camera_store.seed(app.state.ctx.engine)
        tasks = [
            asyncio.create_task(mirror_cameras(app)),
            asyncio.create_task(forward_camera_windows(app)),
        ]
    yield
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    if app.state.ctx:
        await app.state.ctx.replay.close()
    await app.state.redis.aclose()


app = FastAPI(title="Arus API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (meta, replay, network, sensors, analytics, models, decisions, cameras):
    app.include_router(r.router)


@app.get("/api/health")
async def health() -> dict:
    missing = check_data()
    try:
        redis_ok = bool(await app.state.redis.ping())
    except Exception:  # noqa: BLE001 - any connection error just means "not ok"
        redis_ok = False

    ctx: AppContext | None = app.state.ctx
    loaded = ctx.models if ctx else {}
    d = settings.data_dir
    # speed-layer worker, as seen through the camera states it keeps fresh in Redis (PLAN §3.1)
    worker = {"cameras_live": 0, "device": None}
    if ctx and redis_ok:
        for c in camera_store.all_cameras(ctx.engine):
            st = await camera_store.state(app.state.redis, c.id)
            if st["status"] == "live":
                worker["cameras_live"] += 1
                worker["device"] = st.get("device_label")
    return {
        "status": "ok",
        "data_ok": not missing and ctx is not None,
        "missing": missing,
        "redis_ok": redis_ok,
        "models": {
            "model_a": bool(loaded.get("model_a") and loaded["model_a"].ok),
            "model_b_1h": bool(loaded.get("model_b_1h") and loaded["model_b_1h"].ok),
            "model_b_3h": bool(loaded.get("model_b_3h") and loaded["model_b_3h"].ok),
            "yolo_ft": (d / "yolo/yolov8s_traffic7.pt").is_file(),
            "yolo_coco": (d / "yolo/yolov8s.pt").is_file(),
        },
        "model_issues": {name: r.error or r.warnings for name, r in loaded.items() if not r.ok},
        "ws_clients": ctx.ws.count if ctx else 0,
        "worker": worker,
    }


@app.websocket("/ws/live")
async def ws_live(ws: WebSocket) -> None:
    ctx: AppContext | None = app.state.ctx
    if ctx is None:
        await ws.close(code=1011)
        return
    await ctx.ws.connect(ws)
    try:
        # greet with the current state so a fresh tab can render without waiting for a tick
        await ctx.ws.send(ws, {"type": "replay", **ctx.replay.state()})
        kpi = await asyncio.to_thread(queries.kpi_at, ctx.batch, ctx.ref, ctx.replay.ts)
        await ctx.ws.send(ws, {"type": "tick", "ts": ctx.replay.ts, "kpi": kpi})
        while True:
            await ws.receive_text()  # clients don't send anything yet; this just waits for disconnect
    except WebSocketDisconnect:
        pass
    finally:
        await ctx.ws.disconnect(ws)
