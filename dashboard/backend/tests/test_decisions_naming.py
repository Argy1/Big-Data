"""Decision log (SQLite) and sensor name cleaning."""

import pytest

from conftest import DEMO_TS

from app.naming import clean_name, fwy_label


def test_decision_roundtrip(client):
    body = {"sensor_id": 403225, "ts": DEMO_TS, "actions": ["Kirim peringatan ke petugas"], "note": "uji"}
    r = client.post("/api/decisions", json=body)
    assert r.status_code == 201
    new_id = r.json()["id"]
    rows = client.get("/api/decisions", params={"sensor_id": 403225}).json()
    row = next(x for x in rows if x["id"] == new_id)
    assert row["actions"] == ["Kirim peringatan ke petugas"] and row["ts"] == DEMO_TS
    # replay ts stays naive (California local); created_at is real time, sent as UTC with offset
    assert r.json()["created_at"].endswith(("Z", "+00:00")) and row["created_at"].endswith(("Z", "+00:00"))


def test_decision_validation(client):
    assert client.post("/api/decisions", json={"sensor_id": 403225, "ts": DEMO_TS, "actions": []}).status_code == 422
    assert client.post("/api/decisions", json={"sensor_id": 1, "ts": DEMO_TS, "actions": ["x"]}).status_code == 404


@pytest.mark.parametrize(
    "raw,clean",
    [
        ("Airport Blvd rm-s-diag", "Airport Blvd"),
        ("Fair Oaks Ave. off ramp", "Fair Oaks Ave"),
        ("WB 237  TO NB101", "WB 237 ke NB 101"),
        ("De La Cruz Blvd rm-s-diag", "De La Cruz Blvd"),
        ("LARK AVE", "Lark Ave"),
        ("N OF FREMONT AVE", "N of Fremont Ave"),
        ("ALMADEN EXPWY  RM-N-DIA", "Almaden Expwy"),
        ("NB 87/SB 87 rm-s-", "NB 87/SB 87"),
        ("S. King Rd off-n-diag", "S King Rd"),
        ("10TH ST", "10th St"),
        ("NB 101 to WB 237 I/C", "NB 101 ke WB 237 I/C"),
    ],
)
def test_clean_name(raw, clean):
    assert clean_name(raw) == clean


def test_placeholder_names(client):
    hot = client.get("/api/analytics/hotspots", params={"limit": 8}).json()
    assert hot[5]["name"] == "Sensor 407360"  # raw "(future) POC", design shows "Sensor 407360"
    meta = {s["sensor_id"]: s["name"] for s in client.get("/api/meta/sensors").json()}
    assert meta[402359] == "Sensor 402359"  # raw "4A5324 loc 62"


def test_cameras_reference(client):
    cams = client.get("/api/cameras").json()
    assert cams[0]["id"] == "CAM-01" and cams[0]["status"] == "reference"
    tl = client.get("/api/cameras/CAM-01/timeline").json()
    assert len(tl) == 7 and all(w["level"] == "heavy" and w["level_index"] == 3 for w in tl)
    assert tl[0]["probs"]["heavy"] == pytest.approx(0.998, abs=0.05)


def test_fwy_label():
    assert [fwy_label(f, d) for f, d in [(101, "S"), (880, "S"), (237, "E"), (85, "S"), (280, "N")]] == [
        "US 101 S", "I-880 S", "SR 237 E", "SR 85 S", "I-280 N",
    ]
