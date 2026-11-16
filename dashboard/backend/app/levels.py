"""Single source of truth for congestion levels and units (PLAN §7).

Mirror of web/lib/levels.ts: both must give identical results for the shared cases
in tests/test_levels.py.
"""

from __future__ import annotations

import math

MPH_TO_KMH = 1.609344

# index -> code in the data (notebook 04 `to_level`) -> Indonesian label
LEVEL_CODES = ("Low", "Moderate", "High", "Severe")
LEVEL_LABELS = ("Lancar", "Melambat", "Padat", "Macet")
CODE_TO_INDEX = {code: i for i, code in enumerate(LEVEL_CODES)}

# Lower bound of the ratio for Lancar / Melambat / Padat. Below the last one = Macet.
RATIO_LANCAR = 0.8
RATIO_MELAMBAT = 0.6
RATIO_PADAT = 0.4

# Model A (camera) classes -> sensor level index. Map by NAME: the class order in
# model_a.joblib is ["heavy", "light", "medium"], not light/medium/heavy.
CAMERA_TO_INDEX = {"light": 0, "medium": 2, "heavy": 3}

CONGESTED = (2, 3)  # "padat/macet" in the KPIs = Padat + Macet


def mph_to_kmh(mph: float | None, ndigits: int | None = 1) -> float | None:
    if mph is None or (isinstance(mph, float) and math.isnan(mph)):
        return None
    kmh = float(mph) * MPH_TO_KMH
    return round(kmh, ndigits) if ndigits is not None else kmh


def ratio_to_level(ratio: float | None) -> int | None:
    """Ratio = speed / v_ff. Boundaries are inclusive at the bottom: 0.8 is Lancar, 0.6 Melambat, 0.4 Padat."""
    if ratio is None or math.isnan(ratio):
        return None
    if ratio < RATIO_PADAT:
        return 3
    if ratio < RATIO_MELAMBAT:
        return 2
    if ratio < RATIO_LANCAR:
        return 1
    return 0


def speed_to_level(speed: float | None, vff: float | None) -> int | None:
    if speed is None or vff is None or not vff:
        return None
    return ratio_to_level(speed / vff)


def code_to_index(code: str | None) -> int | None:
    return CODE_TO_INDEX.get(code) if code else None


def label(index: int | None) -> str | None:
    return LEVEL_LABELS[index] if index is not None else None


def is_congested(index: int | None) -> bool:
    return index in CONGESTED
