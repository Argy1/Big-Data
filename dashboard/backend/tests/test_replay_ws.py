"""ReplayClock bounds/steps, REST control, and WebSocket `tick` after `step` (Fase 1 criteria)."""

import asyncio
from datetime import datetime

from conftest import DEMO_TS

from app.replay import ReplayClock

MIN, MAX = datetime(2017, 6, 1), datetime(2017, 6, 30, 22, 45)


def run(coro):
    return asyncio.run(coro)


def test_clock_bounds_and_steps():
    async def go():
        ticks = []

        async def on_tick(ts):
            ticks.append(ts)

        c = ReplayClock(datetime(2017, 6, 7, 16, 52), MIN, MAX, 5, on_tick)
        assert c.ts == datetime(2017, 6, 7, 16, 45)  # floored to 15 min
        await c.step(1)
        assert c.ts == datetime(2017, 6, 7, 17, 0)
        await c.step(-2)
        assert c.ts == datetime(2017, 6, 7, 16, 30)
        await c.seek(datetime(2017, 7, 5))
        assert c.ts == MAX
        await c.step(1)
        assert c.ts == MAX
        await c.seek(datetime(2017, 5, 1))
        assert c.ts == MIN
        assert len(ticks) == 5

    run(go())


def test_clock_play_advances_and_stops_at_end():
    async def go():
        states = []

        async def on_state(running):
            states.append(running)

        c = ReplayClock(datetime(2017, 6, 30, 22, 15), MIN, MAX, 0.2, None, on_state)
        await c.play()
        await asyncio.sleep(0.9)  # 2 ticks to 22:45, then stop on the next one
        assert c.ts == MAX and not c.running
        assert states == [True, False]

    run(go())


def test_rest_step_and_seek(client):
    state = client.get("/api/replay").json()
    assert state["ts"] == DEMO_TS and state["running"] is False
    assert state["min_ts"] == "2017-06-01T00:00:00"
    assert state["max_ts"] == "2017-06-30T22:45:00"  # last origin in forecasts_june.parquet

    assert client.post("/api/replay", json={"action": "step"}).json()["ts"] == "2017-06-07T17:00:00"
    assert client.post("/api/replay", json={"action": "step", "steps": -1}).json()["ts"] == DEMO_TS
    assert client.post("/api/replay", json={"action": "seek"}).status_code == 422
    assert client.post("/api/replay", json={"action": "rewind"}).status_code == 422


def test_ws_receives_tick_after_step(client):
    with client.websocket_connect("/ws/live") as ws:
        hello = ws.receive_json()
        assert hello["type"] == "replay" and hello["ts"] == DEMO_TS
        first = ws.receive_json()
        assert first["type"] == "tick" and first["kpi"]["congested_now"] == 89

        r = client.post("/api/replay", json={"action": "step"})
        assert r.status_code == 200
        msg = ws.receive_json()
        assert msg["type"] == "tick"
        assert msg["ts"] == "2017-06-07T17:00:00"
        assert set(msg["kpi"]) >= {"avg_speed", "congested_now", "congested_1h", "congested_3h"}


def test_ws_play_pause_messages(client):
    with client.websocket_connect("/ws/live") as ws:
        ws.receive_json(), ws.receive_json()  # greeting
        client.post("/api/replay", json={"action": "play", "tick_seconds": 0.2})
        started = ws.receive_json()
        assert started["type"] == "replay" and started["running"] is True
        tick = ws.receive_json()
        assert tick["type"] == "tick" and tick["ts"] == "2017-06-07T17:00:00"
        client.post("/api/replay", json={"action": "pause"})
        # drain until the pause notice (another tick may land first)
        for _ in range(5):
            m = ws.receive_json()
            if m["type"] == "replay":
                assert m["running"] is False
                break
        else:
            raise AssertionError("no replay pause message")
