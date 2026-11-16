"""Reference data computed once at startup and cached in memory (PLAN §6)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .db import Batch
from .levels import mph_to_kmh
from .naming import display_name, fwy_label

# Model A features shown in FeatureBars, plus the extra counts the timeline shows
FEATURE_MEDIAN_COLS = ["speed_bl_med", "speed_bl_p25", "stopped_ratio", "occupancy", "track_len_ratio", "optflow_bl"]


@dataclass
class RefData:
    sensors: pd.DataFrame  # one row per sensor, index = sensor_id
    min_ts: datetime
    max_ts: datetime
    model_a_config: dict[str, Any]
    model_b_config: dict[str, Any]
    yolo_info: dict[str, Any]
    class_medians: dict[str, dict[str, float]]
    importance_1h: list[dict[str, Any]]
    importance_3h: list[dict[str, Any]]
    master_bytes: int
    n_ucsd_clips: int
    r2_profile: float  # share of speed variance explained by the sensor × weekday × hour profile
    raw_csv_bytes: int | None  # size of Dataset/PEMS-BAY.csv, from data/manifest.json (copy_data.py)


def _sensor_table(batch: Batch) -> pd.DataFrame:
    df = batch.df(
        """SELECT m.sensor_id, m.name AS name_raw, m.fwy, m.dir, m.lanes, m.latitude AS lat,
                  m.longitude AS lon, v.v_ff
           FROM meta m JOIN vff v USING (sensor_id) ORDER BY m.sensor_id"""
    )
    df["name"] = [display_name(n, i) for n, i in zip(df["name_raw"], df["sensor_id"])]
    df["fwy_label"] = [fwy_label(f, d) for f, d in zip(df["fwy"], df["dir"])]
    # schematic position 0..100 (min-max), y flipped so north is up (PLAN §6)
    df["x"] = ((df["lon"] - df["lon"].min()) / (df["lon"].max() - df["lon"].min()) * 100).round(2)
    df["y"] = ((df["lat"].max() - df["lat"]) / (df["lat"].max() - df["lat"].min()) * 100).round(2)
    df["vff_kmh"] = df["v_ff"].map(lambda v: mph_to_kmh(v))
    return df.set_index("sensor_id", drop=False)


def _importance(model: Any) -> list[dict[str, Any]]:
    gain = pd.Series(model.booster_.feature_importance("gain"), index=model.booster_.feature_name())
    share = (gain / gain.sum()).sort_values(ascending=False)
    return [{"feature": f, "gain": round(float(v), 4)} for f, v in share.items()]


def _r2_profile(batch: Batch) -> float:
    """Notebook 01 §5 'Seberapa rutin kemacetan ini?': R² of predicting every reading with the
    mean of its sensor × weekday × hour over the master dataset (~0,5 s with DuckDB)."""
    (r2,) = batch.one(
        """WITH x AS (SELECT sensor_id, speed, isodow(timestamp) - 1 AS dow, hour(timestamp) AS h FROM master),
                p AS (SELECT sensor_id, dow, h, avg(speed) AS mu FROM x GROUP BY ALL),
                g AS (SELECT avg(speed) AS gm FROM x)
           SELECT 1 - sum((x.speed - p.mu) ^ 2) / sum((x.speed - g.gm) ^ 2)
           FROM x JOIN p USING (sensor_id, dow, h), g"""
    )
    return float(r2)


def load_refdata(data_dir: Path, batch: Batch, models: dict[str, Any]) -> RefData:
    min_ts, max_ts = batch.one("SELECT min(timestamp), max(timestamp) FROM forecasts")

    ucsd = pd.read_csv(data_dir / "model_a" / "ucsd_features.csv")
    medians = ucsd.groupby("label")[FEATURE_MEDIAN_COLS].median().round(4)

    def read_json(rel: str) -> dict[str, Any]:
        return json.loads((data_dir / rel).read_text(encoding="utf-8"))

    manifest = read_json("manifest.json") if (data_dir / "manifest.json").is_file() else {}

    return RefData(
        sensors=_sensor_table(batch),
        min_ts=min_ts,
        max_ts=max_ts,
        model_a_config=read_json("model_a/model_a_config.json"),
        model_b_config=read_json("model_b/model_b_config.json"),
        yolo_info=read_json("yolo/yolov8s_traffic7_info.json"),
        class_medians={lbl: row.to_dict() for lbl, row in medians.iterrows()},
        importance_1h=_importance(models["model_b_1h"]) if models.get("model_b_1h") is not None else [],
        importance_3h=_importance(models["model_b_3h"]) if models.get("model_b_3h") is not None else [],
        master_bytes=sum(p.stat().st_size for p in (data_dir / "batch" / "master").rglob("*.parquet")),
        n_ucsd_clips=len(ucsd),
        r2_profile=_r2_profile(batch),
        raw_csv_bytes=manifest.get("raw_csv_bytes"),
    )
