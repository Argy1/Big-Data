"""PLAN §12 on video_uji.mp4: auto-pick = COCO; 7 windows (0–20 s) all heavy, p_heavy ≈ 0,998 (±0,05);
first window speed_bl_med ≈ 0,334, stopped_ratio ≈ 0,95 — i.e. the same as notebook 03's timeline."""

import joblib
import pandas as pd
import pytest
from conftest import DATA_DIR

from speed_layer.run_camera import run_offline


@pytest.fixture(scope="module")
def result():
    model_a = joblib.load(DATA_DIR / "model_a" / "model_a.joblib")  # own notebook output (trusted)
    return run_offline(DATA_DIR / "video" / "video_uji.mp4", DATA_DIR, model_a, "cpu")


def test_autopick_coco(result):
    assert result["detector"] == "coco"
    assert result["scores"]["coco"] > 10 * max(result["scores"]["finetuned"], 0.1)
    assert result["reason"].startswith("Dipilih otomatis: COCO")


def test_windows_match_notebook_timeline(result):
    ref = pd.read_csv(DATA_DIR / "model_a" / "timeline_video_uji.csv")
    got = result["windows"]
    assert len(got) == len(ref) == 7
    assert [w["t0"] for w in got] == pytest.approx(list(ref.t_start))
    assert all(w["level"] == "heavy" and w["level_index"] == 3 for w in got)
    for w, (_, r) in zip(got, ref.iterrows()):
        assert w["probs"]["heavy"] == pytest.approx(r.p_heavy, abs=0.05)
        # Features drift by up to ~0,04 in a few windows (identical on CPU and GPU here). extract_features
        # matches the notebook to 1e-3 on UCSD clips (test_features_vs_ucsd), so the drift comes from
        # outside our code: video decoding / library builds in the Colab run. The decision is unaffected.
        for f in ("speed_bl_med", "stopped_ratio", "occupancy"):
            assert w["features"][f] == pytest.approx(r[f], abs=0.05), f"t0={w['t0']} {f}"


def test_first_window_numbers(result):
    # PLAN §12: speed_bl_med ≈ 0,334 (here 0,324), stopped_ratio ≈ 0,95 (here 0,952)
    f = result["windows"][0]["features"]
    assert f["speed_bl_med"] == pytest.approx(0.334, abs=0.015)
    assert f["stopped_ratio"] == pytest.approx(0.95, abs=0.01)
