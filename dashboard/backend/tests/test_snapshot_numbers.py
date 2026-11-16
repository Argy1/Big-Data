"""PLAN §12 acceptance numbers: network snapshot, sensors, alerts at Wed 7 Jun 2017 16:45."""

import pytest

from conftest import DEMO_TS


def test_snapshot_demo(client):
    body = client.get("/api/network/snapshot", params={"ts": DEMO_TS}).json()
    kpi = body["kpi"]
    assert body["ts"] == DEMO_TS
    assert kpi["avg_speed"] == 83.1
    assert (kpi["congested_now"], kpi["congested_1h"], kpi["congested_3h"]) == (89, 117, 7)
    assert body["counts"] == {"now": [198, 38, 44, 45], "h1": [159, 49, 57, 60], "h3": [302, 16, 2, 5]}
    assert len(body["sensors"]) == 325
    # design: "−3,3 vs normal Rabu 16:00 (86,4)" · "normal jam ini 21,5%" · "74 memburuk · 6 membaik"
    assert kpi["normal_speed"] == 86.4
    assert kpi["normal_hour"] == 16
    assert kpi["normal_congested_pct"] == 21.5
    assert (kpi["worse_1h"], kpi["better_1h"]) == (74, 6)
    assert kpi["alerts_1h"] == 31  # Lancar/Melambat now -> Padat/Macet in 1 h


def test_snapshot_defaults_to_replay_time(client):
    assert client.get("/api/network/snapshot").json()["ts"] == DEMO_TS


def test_snapshot_sensor_row(client):
    body = client.get("/api/network/snapshot", params={"ts": DEMO_TS}).json()
    s = next(x for x in body["sensors"] if x["sensor_id"] == 403225)
    assert (round(s["speed_now"]), round(s["pred_1h"]), round(s["pred_3h"])) == (99, 46, 100)
    assert (s["level_now"], s["level_1h"], s["level_3h"]) == (0, 2, 0)


def test_ts_is_floored_and_clamped(client):
    assert client.get("/api/network/snapshot", params={"ts": "2017-06-07T16:52"}).json()["ts"] == DEMO_TS
    assert client.get("/api/network/snapshot", params={"ts": "2017-05-01T00:00"}).json()["ts"] == "2017-06-01T00:00:00"


def test_sensor_403225(client):
    body = client.get("/api/sensors/403225", params={"ts": DEMO_TS}).json()
    assert body["name"] == "Airport Blvd"
    assert body["fwy_label"] == "I-880 S"
    assert body["vff_kmh"] == pytest.approx(109, abs=0.5)
    speeds = [round(body[k]["speed"]) for k in ("now", "h1", "h3")]
    ratios = [body[k]["ratio"] for k in ("now", "h1", "h3")]
    levels = [body[k]["level"] for k in ("now", "h1", "h3")]
    assert speeds == [99, 46, 100]
    assert ratios == [0.91, 0.42, 0.92]
    assert levels == [0, 2, 0]
    assert [body[k]["ts"] for k in ("now", "h1", "h3")] == [DEMO_TS, "2017-06-07T17:45:00", "2017-06-07T19:45:00"]
    # profile Wednesday 17:00 (the +1 h target hour) = 48,6 km/jam
    assert body["h1"]["profile"] == 48.6


def test_sensor_unknown_is_404(client):
    assert client.get("/api/sensors/1").status_code == 404


def test_alerts_1h(client):
    body = client.get("/api/alerts", params={"ts": DEMO_TS, "horizon": "1h", "limit": 6}).json()
    got = [(a["sensor_id"], round(a["speed_now"]), round(a["pred"]), a["level_pred"]) for a in body]
    # sorted by drop (km/jam) desc, ties by sensor_id asc (403225 and 403265 both drop 53,2)
    assert got == [
        (403225, 99, 46, 2),
        (403265, 94, 41, 3),
        (404585, 102, 51, 2),
        (400869, 94, 44, 3),
        (401351, 101, 52, 2),
        (400792, 93, 46, 2),
    ]
    names = [a["name"] for a in body]
    assert names == ["Airport Blvd", "Coleman Ave", "Fair Oaks Ave", "Moffett Blvd", "WB 237 ke NB 101", "Bascom Ave"]
    assert all(a["level_now"] in (0, 1) for a in body)


def test_alerts_3h_and_validation(client):
    body = client.get("/api/alerts", params={"ts": DEMO_TS, "horizon": "3h", "limit": 20}).json()
    assert all(a["level_now"] in (0, 1) and a["level_pred"] in (2, 3) for a in body)
    assert client.get("/api/alerts", params={"horizon": "2h"}).status_code == 422


def test_meta_sensors(client):
    body = client.get("/api/meta/sensors").json()
    assert len(body) == 325
    xs, ys = [s["x"] for s in body], [s["y"] for s in body]
    assert min(xs) == 0 and max(xs) == 100 and min(ys) == 0 and max(ys) == 100
    s = next(x for x in body if x["sensor_id"] == 403225)
    assert s["name_raw"] == "Airport Blvd rm-s-diag"
