"""levels.py — boundaries are inclusive at the bottom (0.4 / 0.6 / 0.8), units mph -> km/jam."""

import math

import pytest

from app.levels import (
    CAMERA_TO_INDEX,
    code_to_index,
    is_congested,
    label,
    mph_to_kmh,
    ratio_to_level,
    speed_to_level,
)

# Shared case table: web/lib/levels.ts must pass the same cases (Vitest, Fase 2).
RATIO_CASES = [
    (1.2, 0), (0.8, 0), (0.7999, 1), (0.6, 1), (0.5999, 2),
    (0.4, 2), (0.3999, 3), (0.0, 3),
]


@pytest.mark.parametrize("ratio,expected", RATIO_CASES)
def test_ratio_to_level(ratio, expected):
    assert ratio_to_level(ratio) == expected


def test_ratio_none_and_nan():
    assert ratio_to_level(None) is None
    assert ratio_to_level(math.nan) is None


def test_speed_to_level_sensor_403225():
    # PLAN §12: 99 -> 46 -> 100 km/jam with v_ff ~ 109 km/jam: Lancar -> Padat -> Lancar
    vff = 108.95
    assert [speed_to_level(s, vff) for s in (99.1, 45.9, 100.5)] == [0, 2, 0]
    assert speed_to_level(50, 0) is None


def test_units():
    assert mph_to_kmh(1) == 1.6
    assert mph_to_kmh(51.6215, 1) == 83.1
    assert mph_to_kmh(67.7, None) == pytest.approx(108.9526, abs=1e-4)
    assert mph_to_kmh(None) is None
    assert mph_to_kmh(math.nan) is None


def test_codes_labels():
    assert [code_to_index(c) for c in ("Low", "Moderate", "High", "Severe")] == [0, 1, 2, 3]
    assert code_to_index(None) is None
    assert [label(i) for i in range(4)] == ["Lancar", "Melambat", "Padat", "Macet"]
    assert [is_congested(i) for i in range(4)] == [False, False, True, True]


def test_camera_mapping_by_name():
    assert CAMERA_TO_INDEX == {"light": 0, "medium": 2, "heavy": 3}
