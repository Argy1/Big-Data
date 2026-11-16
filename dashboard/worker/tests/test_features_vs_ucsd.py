"""PLAN §12: features.py reproduces ucsd_features.csv (notebook 03) within 1e-3 on >= 3 UCSD clips."""

import math

import pandas as pd
import pytest
from conftest import DATA_DIR, UCSD_DIR

from speed_layer.features import extract_features, read_clip

FEATURES = ["speed_bl_med", "speed_bl_p25", "stopped_ratio", "optflow_bl", "occupancy",
            "track_len_ratio", "det_mean", "tracks_per_s", "flow_per_min"]
COCO_VEH = [2, 3, 5, 7]  # car, motorcycle, bus, truck (notebook 03 cell 10)


@pytest.fixture(scope="module")
def coco():
    from ultralytics import YOLO

    return YOLO(str(DATA_DIR / "yolo" / "yolov8s.pt"))


@pytest.fixture(scope="module")
def reference():
    return pd.read_csv(DATA_DIR / "model_a" / "ucsd_features.csv").set_index("file")


# one clip per class, the first of each label in ucsd_features.csv
@pytest.mark.parametrize("label", ["light", "medium", "heavy"])
def test_features_match_notebook(label, coco, reference):
    clip = reference[reference.label == label].index[0]
    path = UCSD_DIR / "video" / f"{clip}.avi"
    if not path.is_file():
        pytest.skip(f"UCSD clip not found: {path}")
    got = extract_features(read_clip(str(path)), coco, COCO_VEH)
    exp = reference.loc[clip]
    for f in FEATURES:
        g, e = got[f], float(exp[f])
        if math.isnan(e):
            assert math.isnan(g), f"{clip} {f}: expected NaN, got {g}"
        else:
            assert g == pytest.approx(e, abs=1e-3), f"{clip} {f}: {g} vs notebook {e}"
