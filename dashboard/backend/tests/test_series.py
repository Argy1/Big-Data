"""Day series: actual up to "now", predictions drawn at their target time (PLAN §7)."""

from conftest import DEMO_TS


def test_network_series_cut_at_now(client):
    body = client.get("/api/network/series", params={"date": "2017-06-07", "ts": DEMO_TS}).json()
    assert body["now"] == 16.75
    # 00:00..16:45 every 15 min = 68 points (same as the design polyline)
    assert len(body["actual"]) == 68
    assert body["actual"][0][0] == 0 and body["actual"][-1][0] == 16.75
    assert body["actual"][-1][1] == 83.1
    # origin 00:00..16:45, drawn at +1 h / +3 h
    assert len(body["pred_1h"]) == 68 and body["pred_1h"][0][0] == 1 and body["pred_1h"][-1][0] == 17.75
    assert len(body["pred_3h"]) == 68 and body["pred_3h"][0][0] == 3 and body["pred_3h"][-1][0] == 19.75
    # hourly profile for Wednesday; 16:00 = the "normal" in the KPI
    assert len(body["profile"]) == 24
    assert body["profile"][16] == [16, 86.4]


def test_network_series_past_day_is_full(client):
    body = client.get("/api/network/series", params={"date": "2017-06-06", "ts": DEMO_TS}).json()
    assert body["now"] is None
    assert len(body["actual"]) == 96
    assert body["pred_1h"][-1][0] == 23.75  # targets stay inside the day
    assert body["pred_3h"][-1][0] == 23.75


def test_network_series_future_day_is_empty(client):
    body = client.get("/api/network/series", params={"date": "2017-06-08", "ts": DEMO_TS}).json()
    assert body["actual"] == [] and body["pred_1h"] == []
    assert len(body["profile"]) == 24


def test_sensor_series(client):
    body = client.get("/api/sensors/403225/series", params={"date": "2017-06-07", "ts": DEMO_TS}).json()
    assert round(body["vff"]) == 109
    assert round(body["actual"][-1][1]) == 99
    p1 = dict(map(tuple, body["pred_1h"]))
    assert round(p1[17.75]) == 46
    assert dict(map(tuple, body["profile"]))[17] == 48.6
