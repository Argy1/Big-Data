"""Cameras (speed layer, PLAN §8.1). The worker publishes into Redis; this router reads it back.

Until a worker runs, the default camera CAM-01 shows notebook 03's reference result on video_uji.mp4
(status "reference"), so the dashboard says honestly that it is not live.
"""

from __future__ import annotations

import asyncio
import re
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import cameras as cam
from ..config import settings
from ..context import Ctx
from ..db import Camera, Session

router = APIRouter(prefix="/api/cameras", tags=["cameras"])

BOUNDARY = "arusframe"
STREAM_IDLE_S = 20  # end an MJPEG response after this long without frames; the browser reconnects
ALLOWED_EXT = {".mp4", ".m4v", ".mov"}


def _redis(request: Request):
    return request.app.state.redis


def _get(ctx, cam_id: str) -> Camera:
    with Session(ctx.engine) as s:
        c = s.get(Camera, cam_id)
    if c is None:
        raise HTTPException(404, f"kamera {cam_id} tidak ditemukan")
    return c


async def _describe(request: Request, ctx, c: Camera) -> dict:
    r = _redis(request)
    try:
        st = await cam.state(r, c.id)
        last = (await cam.windows(r, c.id, 1) or [None])[-1]
    except Exception:  # noqa: BLE001 - Redis down: show the camera as offline instead of failing
        st, last = {"status": "offline"}, None
    if st["status"] in ("offline", "starting") and last is None and c.id == cam.DEFAULT_CAMERA.id:
        ref = cam.reference_timeline(settings.data_dir / "model_a" / "timeline_video_uji.csv")
        if st["status"] == "offline":
            st = {"status": "reference"}
        last = ref[-1]
    return {
        "id": c.id,
        "name": c.name,
        "source": c.source.partition(":")[2],
        "original_filename": c.original_filename,
        "detector_mode": c.detector_mode,
        "detector_active": st.get("detector_active", "coco" if st["status"] == "reference" else None),
        "detector_reason": st.get("detector_reason"),
        "det_scores": st.get("det_scores"),
        "status": st["status"],
        "device_label": st.get("device_label"),
        "width": st.get("width"),
        "height": st.get("height"),
        "fps": st.get("fps"),
        "error": st.get("error"),
        "note": st.get("note"),
        "last": last,
    }


@router.get("")
async def list_cameras(request: Request, ctx: Ctx):
    return [await _describe(request, ctx, c) for c in cam.all_cameras(ctx.engine)]


@router.get("/{camera_id}")
async def get_camera(camera_id: str, request: Request, ctx: Ctx):
    return await _describe(request, ctx, _get(ctx, camera_id))


@router.get("/{camera_id}/timeline")
async def timeline(camera_id: str, request: Request, ctx: Ctx, limit: int = Query(20, ge=1, le=200)):
    _get(ctx, camera_id)
    try:
        wins = await cam.windows(_redis(request), camera_id, limit)
    except Exception:  # noqa: BLE001
        wins = []
    if not wins and camera_id == cam.DEFAULT_CAMERA.id:
        wins = cam.reference_timeline(settings.data_dir / "model_a" / "timeline_video_uji.csv")[-limit:]
    return wins


class DetectorBody(BaseModel):
    mode: Literal["auto", "coco", "finetuned"]


@router.post("/{camera_id}/detector")
async def set_detector(camera_id: str, body: DetectorBody, request: Request, ctx: Ctx):
    with Session(ctx.engine) as s:
        c = s.get(Camera, camera_id)
        if c is None:
            raise HTTPException(404, f"kamera {camera_id} tidak ditemukan")
        c.detector_mode = body.mode
        s.add(c)
        s.commit()
        s.refresh(c)
    # the worker re-reads cam:cfg before every window, so the switch applies within ~2,5 s
    await _redis(request).hset(f"cam:cfg:{camera_id}", "detector_mode", body.mode)
    return await _describe(request, ctx, c)


@router.post("", status_code=201)
async def upload_camera(request: Request, ctx: Ctx, file: UploadFile = File(...), name: str = Form("")):
    filename = file.filename or "video.mp4"
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in ALLOWED_EXT:
        raise HTTPException(415, "Format tidak didukung: unggah video .mp4")
    cam_id = cam.next_id(ctx.engine)
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)[-80:]
    stored = f"{cam_id.lower()}-{safe}"
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.upload_dir / stored
    limit = settings.max_upload_mb * 1024 * 1024
    size = 0
    try:
        with dest.open("wb") as out:
            while chunk := await file.read(1 << 20):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(413, f"Video lebih dari {settings.max_upload_mb} MB")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    c = Camera(
        id=cam_id,
        name=(name.strip() or f"Unggahan · {filename}")[:120],
        source=f"uploads:{stored}",
        original_filename=filename,
    )
    with Session(ctx.engine) as s:
        s.add(c)
        s.commit()
        s.refresh(c)
    r = _redis(request)
    try:
        await cam.mirror(r, cam.all_cameras(ctx.engine))
        await r.xadd("jobs", {"camera_id": cam_id, "action": "start"}, maxlen=100, approximate=True)
    except Exception:  # noqa: BLE001 - Redis down: the periodic mirror in main.py catches up
        cam.log.warning("Redis tidak tersedia saat upload %s; kamera akan disinkronkan nanti", cam_id)
    return await _describe(request, ctx, c)


@router.delete("/{camera_id}", status_code=204)
async def delete_camera(camera_id: str, request: Request, ctx: Ctx):
    """Remove an uploaded camera (the default CAM-01 stays). The worker stops it within ~2 s."""
    if camera_id == cam.DEFAULT_CAMERA.id:
        raise HTTPException(400, "Kamera bawaan tidak bisa dihapus")
    c = _get(ctx, camera_id)
    with Session(ctx.engine) as s:
        s.delete(s.get(Camera, camera_id))
        s.commit()
    if (path := cam.resolve_upload(settings.upload_dir, c.source)) is not None:
        path.unlink(missing_ok=True)
    r = _redis(request)
    try:
        await cam.mirror(r, cam.all_cameras(ctx.engine))
        await r.delete(f"cam:cfg:{camera_id}", f"cam:state:{camera_id}", f"camera:{camera_id}", f"frame:{camera_id}", f"frame:{camera_id}:seq")
    except Exception:  # noqa: BLE001 - Redis down: the periodic mirror drops it from cam:ids later
        cam.log.warning("Redis tidak tersedia saat menghapus %s", camera_id)


@router.get("/{camera_id}/stream.mjpg")
async def stream(camera_id: str, request: Request, ctx: Ctx):
    """multipart/x-mixed-replace of the latest annotated JPEG the worker wrote to Redis (~10 fps)."""
    _get(ctx, camera_id)
    r = _redis(request)

    async def gen():
        last_seq = None
        idle_since = asyncio.get_event_loop().time()
        while not await request.is_disconnected():
            seq = await r.get(f"frame:{camera_id}:seq")
            if seq is not None and seq != last_seq:
                jpeg = await r.get(f"frame:{camera_id}")
                if jpeg:
                    last_seq = seq
                    idle_since = asyncio.get_event_loop().time()
                    yield (
                        f"--{BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: {len(jpeg)}\r\n\r\n".encode()
                        + jpeg
                        + b"\r\n"
                    )
            elif asyncio.get_event_loop().time() - idle_since > STREAM_IDLE_S:
                return
            await asyncio.sleep(0.04)

    return StreamingResponse(
        gen(),
        media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
        headers={"Cache-Control": "no-store"},
    )
