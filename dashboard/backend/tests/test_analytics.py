"""PLAN §12: heatmap, daily trend, hotspots, summary, model metrics."""

import pytest


def test_heatmap_peak_thursday_17(client):
    body = client.get("/api/analytics/heatmap").json()
    assert body["days"] == ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    values = body["values"]
    assert len(values) == 7 and all(len(r) == 24 for r in values)
    peak = max((v, d, h) for d, row in enumerate(values) for h, v in enumerate(row))
    assert peak == (33.1, 3, 17)  # Kamis 17:00
    assert max(values[5]) < 2 and max(values[6]) < 2  # Sabtu & Minggu


def test_daily(client):
    body = client.get("/api/analytics/daily").json()
    assert len(body) == 181
    assert body[0]["date"] == "2017-01-01" and body[-1]["date"] == "2017-06-30"
    assert round(max(r["pct_congested"] for r in body), 1) == 10.2


def test_hotspots(client):
    body = client.get("/api/analytics/hotspots", params={"limit": 8}).json()
    assert len(body) == 8
    top = body[0]
    assert top["rank"] == 1 and top["name"] == "De La Cruz Blvd" and top["fwy_label"] == "US 101 S"
    assert round(top["pct_congested"], 1) == 18.6 and round(top["pct_severe"], 1) == 15.3
    assert [h["rank"] for h in body] == list(range(1, 9))


def test_summary(client):
    body = client.get("/api/analytics/summary").json()
    assert body["n_readings"] == 16_937_700  # "16,9 jt"
    assert body["n_days"] == 181
    assert round(body["pct_congested_mean"], 1) == 5.1
    assert round(body["pct_congested_max"], 1) == 10.2
    assert round(body["master_mb"]) == 28
    assert (body["first_date"], body["last_date"]) == ("2017-01-01", "2017-06-30")
    assert round(body["raw_csv_mb"]) == 86
    # notebook 01 §5: the routine profile explains ~73% of speed variance, the rest is Model B's job
    assert body["r2_profile"] == pytest.approx(0.733, abs=0.001)
    assert "2017-05-29" in body["holidays"]


def test_model_metrics(client):
    body = client.get("/api/models/metrics").json()
    assert body["yolo"]["map50"] == pytest.approx(0.879, abs=5e-4)
    assert body["yolo"]["recall"] == pytest.approx(0.800, abs=5e-4)

    rf = body["model_a"]["cv_results"]["Random Forest"]
    assert (rf["accuracy"], rf["macro_f1"]) == (0.945, 0.91)

    tm = {(m["horizon"], m["subset"], m["method"]): m for m in body["model_b"]["test_metrics"]}
    b1, b3 = tm[("1h", "Semua", "Model B")], tm[("3h", "Semua", "Model B")]
    assert b1["mae_kmh"] == 3.21 and b1["recall_congested"] == pytest.approx(0.701, abs=1e-3)
    assert b3["mae_kmh"] == 3.56 and b3["recall_congested"] == pytest.approx(0.678, abs=1e-3)
    assert len(body["model_b"]["test_metrics"]) == 12
    assert body["model_a"]["n_clips"] == 254 and body["model_b"]["weather"] is True
    worst = min(body["yolo"]["per_class"], key=lambda c: c["mAP50"])
    assert (worst["kelas"], worst["mAP50"]) == ("truck", 0.755)


def test_class_medians(client):
    # PLAN §6 design reference: speed 2,21 / 1,01 / 0,54 · stopped 0 / 0,10 / 0,46 · occupancy 0,02 / 0,11 / 0,16
    med = client.get("/api/models/metrics").json()["model_a"]["class_medians"]
    for cls, speed, stopped, occ in (("light", 2.21, 0, 0.02), ("medium", 1.01, 0.10, 0.11), ("heavy", 0.54, 0.46, 0.16)):
        assert med[cls]["speed_bl_med"] == pytest.approx(speed, abs=0.01)
        assert med[cls]["stopped_ratio"] == pytest.approx(stopped, abs=0.01)
        assert med[cls]["occupancy"] == pytest.approx(occ, abs=0.01)


def test_importance_matches_notebook_figure(client):
    # Output IPYNB/.../04_model_b/figures/03_feature_importance.png (full Colab run, model in data/)
    imp = client.get("/api/models/metrics").json()["importance_1h"]
    top = [f["feature"] for f in imp[:5]]
    assert top == ["dev_now", "prof_target", "hour_target", "v_yesterday", "ratio_now"]
    g = {f["feature"]: f["gain"] for f in imp}
    assert g["dev_now"] == pytest.approx(0.422, abs=0.002)
    assert g["prof_target"] == pytest.approx(0.107, abs=0.002)
    assert g["v_std60m"] == pytest.approx(0.037, abs=0.002)
    assert g["nb_ratio_now"] == pytest.approx(0.032, abs=0.002)
    assert sum(g.values()) == pytest.approx(1, abs=1e-3)
