"""Camera endpoints against a fake Redis that plays the worker's side of the contract
(worker/speed_layer/publisher.py)."""

import json
import time

import fakeredis
import pytest

from app.main import app

WINDOW = {
    "camera_id": "CAM-01", "seq": 0, "loop": 0, "t0": 0.0, "t1": 5.0, "level": "heavy", "level_index": 3,
    "conf": 0.998, "probs": {"heavy": 0.998, "light": 0.0, "medium": 0.002},
    "features": {"speed_bl_med": 0.324, "stopped_ratio": 0.952, "occupancy": 0.337}, "det_mean": 13.2,
    "flow_per_min": 36.0, "detector": "coco", "ts": "2026-10-29T00:00:00+00:00",
}


@pytest.fixture
def fake_redis():
    real = app.state.redis
    fake = fakeredis.FakeAsyncRedis()
    app.state.redis = fake
    yield fake
    app.state.redis = real


async def worker_publishes(r, cam="CAM-01", n=1):
    await r.hset(f"cam:state:{cam}", mapping={
        "status": "live", "device_label": "GPU · RTX 5050", "detector_mode": "auto", "detector_active": "coco",
        "detector_reason": "Dipilih otomatis: COCO 23,7 vs fine-tuned 1,3 deteksi/frame.",
        "det_scores": json.dumps({"coco": 23.7, "finetuned": 1.3}), "width": "640", "height": "360",
        "fps": "10.0", "loop": "0", "updated": f"{time.time():.3f}",
    })
    for i in range(n):
        await r.xadd(f"camera:{cam}", {"data": json.dumps({**WINDOW, "camera_id": cam, "seq": i, "t0": 2.5 * i, "t1": 2.5 * i + 5})})


def test_live_camera_and_timeline(client, fake_redis):
    client.portal.call(worker_publishes, fake_redis, "CAM-01", 3)
    cams = client.get("/api/cameras").json()
    c = next(x for x in cams if x["id"] == "CAM-01")
    assert c["status"] == "live" and c["device_label"] == "GPU · RTX 5050"
    assert c["det_scores"] == {"coco": 23.7, "finetuned": 1.3}
    assert c["last"]["seq"] == 2 and c["width"] == 640
    tl = client.get("/api/cameras/CAM-01/timeline", params={"limit": 2}).json()
    assert [w["seq"] for w in tl] == [1, 2]  # oldest first


def test_stale_state_is_offline(client, fake_redis):
    async def stale():
        await fake_redis.hset("cam:state:CAM-01", mapping={"status": "live", "updated": str(time.time() - 60)})

    client.portal.call(stale)
    c = client.get("/api/cameras/CAM-01").json()
    assert c["status"] == "reference"  # worker silent: CAM-01 falls back to notebook 03's result


def test_detector_switch_reaches_worker_config(client, fake_redis):
    r = client.post("/api/cameras/CAM-01/detector", json={"mode": "finetuned"})
    assert r.status_code == 200 and r.json()["detector_mode"] == "finetuned"
    assert client.portal.call(fake_redis.hget, "cam:cfg:CAM-01", "detector_mode") == b"finetuned"
    assert client.post("/api/cameras/CAM-01/detector", json={"mode": "x"}).status_code == 422
    client.post("/api/cameras/CAM-01/detector", json={"mode": "auto"})


def test_upload_creates_camera(client, fake_redis, tmp_path):
    from app.config import settings

    original = settings.upload_dir
    object.__setattr__(settings, "upload_dir", tmp_path)  # Settings is frozen
    r = client.post("/api/cameras", files={"file": ("jalan kota.mp4", b"\x00" * 1024, "video/mp4")}, data={"name": "Uji unggah"})
    assert r.status_code == 201, r.text
    cam = r.json()
    assert cam["id"].startswith("CAM-") and cam["id"] != "CAM-01" and cam["name"] == "Uji unggah"
    assert (tmp_path / cam["source"]).is_file()
    ids = client.portal.call(fake_redis.smembers, "cam:ids")
    assert cam["id"].encode() in ids
    cfg = client.portal.call(fake_redis.hgetall, f"cam:cfg:{cam['id']}")
    assert cfg[b"source"].startswith(b"uploads:")
    bad = client.post("/api/cameras", files={"file": ("x.txt", b"hi", "text/plain")})
    assert bad.status_code == 415
    # delete: row, file and Redis entries go; the default camera can't be deleted
    assert client.delete(f"/api/cameras/{cam['id']}").status_code == 204
    assert not (tmp_path / cam["source"]).exists()
    assert cam["id"].encode() not in client.portal.call(fake_redis.smembers, "cam:ids")
    assert client.get(f"/api/cameras/{cam['id']}").status_code == 404
    assert client.delete("/api/cameras/CAM-01").status_code == 400
    object.__setattr__(settings, "upload_dir", original)


def test_mjpeg_stream_sends_frames(client, fake_redis, monkeypatch):
    from app.routers import cameras as router

    # TestClient reads the whole body, so let the endless stream end soon after the last frame
    monkeypatch.setattr(router, "STREAM_IDLE_S", 0.5)
    jpeg = b"\xff\xd8fakejpeg\xff\xd9"

    async def frame():
        await fake_redis.set("frame:CAM-01", jpeg)
        await fake_redis.incr("frame:CAM-01:seq")

    client.portal.call(frame)
    resp = client.get("/api/cameras/CAM-01/stream.mjpg")
    assert resp.headers["content-type"].startswith("multipart/x-mixed-replace")
    assert b"--arusframe\r\nContent-Type: image/jpeg" in resp.content and jpeg in resp.content


def test_ws_forwards_camera_windows(client, fake_redis):
    """The forwarder skips windows that existed before it first saw a stream (no replay of old
    windows after an API restart), so keep publishing new windows until one comes through. A replay
    `step` after each publish guarantees a `tick`, so receive_json() can never block forever."""
    camera = None
    with client.websocket_connect("/ws/live") as ws:
        ws.receive_json(), ws.receive_json()  # replay + tick greeting
        for attempt in range(8):
            client.portal.call(worker_publishes, fake_redis, "CAM-01", 1)
            time.sleep(0.8)  # > forwarder poll interval (0,3 s)
            client.post("/api/replay", json={"action": "step", "steps": 1 if attempt % 2 == 0 else -1})
            while True:
                msg = ws.receive_json()
                if msg["type"] == "camera":
                    camera = msg
                if msg["type"] == "tick":
                    break
            if camera:
                break
    assert camera is not None, "no camera message forwarded"
    assert camera["camera_id"] == "CAM-01" and camera["level"] == "heavy" and camera["window"]["detector"] == "coco"
