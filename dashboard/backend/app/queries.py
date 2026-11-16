"""Read-side queries for the serving layer. All speeds leave this module in km/jam.

Replay data (forecasts_june.parquet) has one row per sensor per 15-minute origin `timestamp`:
speed_now is measured at the origin, pred_1h / pred_3h are Model B forecasts made AT the
origin FOR origin+1h / origin+3h (PLAN §7: predictions are drawn at their target time).
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

from .db import Batch
from .levels import CODE_TO_INDEX, mph_to_kmh
from .refdata import RefData

STEP = timedelta(minutes=15)
HORIZONS = {"1h": timedelta(hours=1), "3h": timedelta(hours=3)}
DAYS_ID = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]


class NotFound(LookupError):
    pass


# ------------------------------------------------------------------ helpers


def floor_15(ts: datetime) -> datetime:
    return ts.replace(minute=ts.minute - ts.minute % 15, second=0, microsecond=0)


def clamp_ts(ts: datetime, ref: RefData) -> datetime:
    return min(max(floor_15(ts), ref.min_ts), ref.max_ts)


def _kmh(x: Any) -> float | None:
    if x is None or (isinstance(x, float) and np.isnan(x)) or pd.isna(x):
        return None
    return mph_to_kmh(float(x))


def _level(code: Any) -> int | None:
    return CODE_TO_INDEX.get(code) if isinstance(code, str) else None


def _hour(ts: datetime) -> float:
    return ts.hour + ts.minute / 60


def _rows_at(batch: Batch, ts: datetime) -> pd.DataFrame:
    return batch.df(
        """SELECT sensor_id, speed_now, level_now, pred_1h, level_1h, pred_3h, level_3h
           FROM forecasts WHERE timestamp = ? ORDER BY sensor_id""",
        [ts],
    )


def _counts(codes: pd.Series) -> list[int]:
    idx = codes.map(_level)
    return [int((idx == i).sum()) for i in range(4)]


def normal_speed(batch: Batch, ts: datetime) -> float | None:
    """Network mean of the historical profile (bv_sensor_profile, Jan–Jun) at the same weekday & hour."""
    row = batch.one(
        "SELECT avg(mean_speed) FROM sensor_profile WHERE dow = ? AND hour = ?", [ts.weekday(), ts.hour]
    )
    return _kmh(row[0]) if row else None


# ------------------------------------------------------------------ network


def snapshot(batch: Batch, ref: RefData, ts: datetime) -> dict[str, Any]:
    ts = clamp_ts(ts, ref)
    rows = _rows_at(batch, ts)
    counts = {"now": _counts(rows.level_now), "h1": _counts(rows.level_1h), "h3": _counts(rows.level_3h)}
    lv_now, lv_1h = rows.level_now.map(_level), rows.level_1h.map(_level)
    both = lv_now.notna() & lv_1h.notna()
    normal_pct = batch.one(
        "SELECT avg(prob_congested) * 100 FROM sensor_profile WHERE dow = ? AND hour = ?", [ts.weekday(), ts.hour]
    )
    kpi = {
        "avg_speed": _kmh(rows.speed_now.mean()),
        "normal_speed": normal_speed(batch, ts),
        "normal_hour": ts.hour,
        "congested_now": sum(counts["now"][2:]),
        "congested_1h": sum(counts["h1"][2:]),
        "congested_3h": sum(counts["h3"][2:]),
        # historical % of sensors Padat/Macet at this weekday & hour (bv_sensor_profile)
        "normal_congested_pct": round(float(normal_pct[0]), 1) if normal_pct and normal_pct[0] is not None else None,
        # sensors whose level goes up / down within 1 h ("74 memburuk · 6 membaik")
        "worse_1h": int((both & (lv_1h > lv_now)).sum()),
        "better_1h": int((both & (lv_1h < lv_now)).sum()),
        # early-warning count: Lancar/Melambat now -> Padat/Macet in 1 h (same rule as /api/alerts)
        "alerts_1h": int((lv_now.isin([0, 1]) & lv_1h.isin([2, 3])).sum()),
        "n_sensors": len(rows),
    }
    sensors = [
        {
            "sensor_id": int(r.sensor_id),
            "speed_now": _kmh(r.speed_now),
            "level_now": _level(r.level_now),
            "pred_1h": _kmh(r.pred_1h),
            "level_1h": _level(r.level_1h),
            "pred_3h": _kmh(r.pred_3h),
            "level_3h": _level(r.level_3h),
        }
        for r in rows.itertuples(index=False)
    ]
    return {"ts": ts, "kpi": kpi, "counts": counts, "sensors": sensors}


def kpi_at(batch: Batch, ref: RefData, ts: datetime) -> dict[str, Any]:
    return snapshot(batch, ref, ts)["kpi"]


def alerts(batch: Batch, ref: RefData, ts: datetime, horizon: str = "1h", limit: int = 6) -> list[dict[str, Any]]:
    """Sensors that are Lancar/Melambat now but forecast Padat/Macet at the horizon.

    Sorted by the forecast speed drop (km/jam, 1 decimal) descending, ties by sensor_id ascending.
    """
    ts = clamp_ts(ts, ref)
    pred_col, lvl_col = f"pred_{horizon}", f"level_{horizon}"
    rows = _rows_at(batch, ts)
    out = []
    for r in rows.itertuples(index=False):
        now_lv, pred_lv = _level(r.level_now), _level(getattr(r, lvl_col))
        if now_lv in (0, 1) and pred_lv in (2, 3):
            s = ref.sensors.loc[int(r.sensor_id)]
            speed_now, pred = _kmh(r.speed_now), _kmh(getattr(r, pred_col))
            out.append({
                "sensor_id": int(r.sensor_id),
                "name": s["name"],
                "fwy": int(s["fwy"]),
                "dir": s["dir"],
                "fwy_label": s["fwy_label"],
                "speed_now": speed_now,
                "pred": pred,
                "level_now": now_lv,
                "level_pred": pred_lv,
                "drop": round(speed_now - pred, 1),
            })
    out.sort(key=lambda a: (-a["drop"], a["sensor_id"]))
    return out[:limit]


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime(day.year, day.month, day.day)
    return start, start + timedelta(days=1)


def _series(batch: Batch, ref: RefData, day: date, now: datetime, sensor_id: int | None) -> dict[str, Any]:
    start, end = _day_bounds(day)
    now = clamp_ts(now, ref)
    cutoff = min(end - STEP, now)  # origins after "now" are the future: not shown in replay
    where = "timestamp BETWEEN ? AND ?" + (" AND sensor_id = ?" if sensor_id is not None else "")
    params: list[Any] = [start, cutoff] + ([sensor_id] if sensor_id is not None else [])
    df = batch.df(
        f"""SELECT timestamp, avg(speed_now) AS v, avg(pred_1h) AS p1, avg(pred_3h) AS p3
            FROM forecasts WHERE {where} GROUP BY timestamp ORDER BY timestamp""",
        params,
    )

    actual, pred_1h, pred_3h = [], [], []
    for r in df.itertuples(index=False):
        t = r.timestamp.to_pydatetime()
        if (v := _kmh(r.v)) is not None:
            actual.append([_hour(t), v])
        for key, pts, col in (("1h", pred_1h, r.p1), ("3h", pred_3h, r.p3)):
            target = t + HORIZONS[key]
            if target < end and (v := _kmh(col)) is not None:
                pts.append([_hour(target), v])

    prof_where = "dow = ?" + (" AND sensor_id = ?" if sensor_id is not None else "")
    prof = batch.df(
        f"SELECT hour, avg(mean_speed) AS v FROM sensor_profile WHERE {prof_where} GROUP BY hour ORDER BY hour",
        [day.weekday()] + ([sensor_id] if sensor_id is not None else []),
    )
    profile = [[float(h), _kmh(v)] for h, v in zip(prof.hour, prof.v)]

    return {
        "date": day,
        "actual": actual,
        "pred_1h": pred_1h,
        "pred_3h": pred_3h,
        "profile": profile,
        "now": _hour(now) if now.date() == day else None,
    }


def network_series(batch: Batch, ref: RefData, day: date, now: datetime) -> dict[str, Any]:
    return _series(batch, ref, day, now, None)


# ------------------------------------------------------------------ sensors


def _sensor_meta(ref: RefData, sensor_id: int) -> dict[str, Any]:
    if sensor_id not in ref.sensors.index:
        raise NotFound(f"sensor {sensor_id} tidak ditemukan")
    s = ref.sensors.loc[sensor_id]
    return {
        "sensor_id": sensor_id,
        "name": s["name"],
        "name_raw": s["name_raw"],
        "fwy": int(s["fwy"]),
        "dir": s["dir"],
        "fwy_label": s["fwy_label"],
        "lanes": int(s["lanes"]),
        "lat": float(s["lat"]),
        "lon": float(s["lon"]),
        "vff_kmh": s["vff_kmh"],
    }


def sensor_detail(batch: Batch, ref: RefData, sensor_id: int, ts: datetime) -> dict[str, Any]:
    meta = _sensor_meta(ref, sensor_id)
    ts = clamp_ts(ts, ref)
    row = batch.df("SELECT * FROM forecasts WHERE timestamp = ? AND sensor_id = ?", [ts, sensor_id])
    if row.empty:
        raise NotFound(f"tidak ada data sensor {sensor_id} pada {ts:%Y-%m-%d %H:%M}")
    r = row.iloc[0]
    vff_mph = float(ref.sensors.loc[sensor_id, "v_ff"])

    def block(at: datetime, speed_mph: Any, code: Any) -> dict[str, Any]:
        prof = batch.one(
            "SELECT mean_speed FROM sensor_profile WHERE sensor_id = ? AND dow = ? AND hour = ?",
            [sensor_id, at.weekday(), at.hour],
        )
        ok = speed_mph is not None and not pd.isna(speed_mph)
        return {
            "ts": at,
            "speed": _kmh(speed_mph) if ok else None,
            "ratio": round(float(speed_mph) / vff_mph, 2) if ok else None,
            "level": _level(code),
            "profile": _kmh(prof[0]) if prof else None,
        }

    return {
        **meta,
        "now": block(ts, r.speed_now, r.level_now),
        "h1": block(ts + HORIZONS["1h"], r.pred_1h, r.level_1h),
        "h3": block(ts + HORIZONS["3h"], r.pred_3h, r.level_3h),
    }


def sensor_series(batch: Batch, ref: RefData, sensor_id: int, day: date, now: datetime) -> dict[str, Any]:
    meta = _sensor_meta(ref, sensor_id)
    return {**_series(batch, ref, day, now, sensor_id), "vff": meta["vff_kmh"]}


def meta_sensors(ref: RefData) -> list[dict[str, Any]]:
    cols = ["sensor_id", "name", "name_raw", "fwy", "dir", "fwy_label", "lanes", "lat", "lon", "x", "y", "vff_kmh"]
    return ref.sensors[cols].to_dict(orient="records")


# ------------------------------------------------------------------ analytics (batch views)


def heatmap(batch: Batch) -> dict[str, Any]:
    """% of readings Padat/Macet per weekday x hour, averaged over sensors (bv_sensor_profile, Jan–Jun)."""
    df = batch.df("SELECT dow, hour, avg(prob_congested) * 100 AS p FROM sensor_profile GROUP BY dow, hour")
    grid = df.pivot(index="dow", columns="hour", values="p").reindex(index=range(7), columns=range(24))
    return {
        "days": DAYS_ID,
        "hours": list(range(24)),
        "values": [[round(float(v), 1) for v in row] for row in grid.to_numpy()],
    }


def daily(batch: Batch) -> list[dict[str, Any]]:
    df = batch.df("SELECT date, pct_congested, avg_speed FROM daily ORDER BY date")
    return [
        {"date": d.date() if hasattr(d, "date") else d, "pct_congested": round(float(p), 2), "avg_speed": _kmh(v)}
        for d, p, v in zip(df.date, df.pct_congested, df.avg_speed)
    ]


def hotspots(batch: Batch, ref: RefData, limit: int = 8) -> list[dict[str, Any]]:
    df = batch.df(
        "SELECT rank, sensor_id, pct_congested, pct_severe, avg_speed FROM hotspots ORDER BY rank LIMIT ?", [limit]
    )
    out = []
    for r in df.itertuples(index=False):
        s = ref.sensors.loc[int(r.sensor_id)]
        out.append({
            "rank": int(r.rank),
            "sensor_id": int(r.sensor_id),
            "name": s["name"],
            "fwy": int(s["fwy"]),
            "dir": s["dir"],
            "fwy_label": s["fwy_label"],
            "pct_congested": round(float(r.pct_congested), 2),
            "pct_severe": round(float(r.pct_severe), 2),
            "avg_speed": _kmh(r.avg_speed),
        })
    return out


def summary(batch: Batch, ref: RefData) -> dict[str, Any]:
    n_readings = batch.one("SELECT count(*) FROM master")[0]
    n_days, mean_p, max_p, first, last_ = batch.one(
        "SELECT count(*), avg(pct_congested), max(pct_congested), min(date), max(date) FROM daily"
    )
    return {
        "n_readings": int(n_readings),
        "n_days": int(n_days),
        "n_sensors": len(ref.sensors),
        "first_date": first,
        "last_date": last_,
        "pct_congested_mean": round(float(mean_p), 2),
        "pct_congested_max": round(float(max_p), 2),
        "master_mb": round(ref.master_bytes / 1e6, 1),
        "raw_csv_mb": round(ref.raw_csv_bytes / 1e6, 1) if ref.raw_csv_bytes else None,
        "r2_profile": round(ref.r2_profile, 4),
        "holidays": ref.model_b_config.get("holidays", []),
    }


# ------------------------------------------------------------------ models


def model_metrics(ref: RefData) -> dict[str, Any]:
    y, a, b = ref.yolo_info, ref.model_a_config, ref.model_b_config
    tm = y["test_metrics"]
    test_metrics = [
        {
            "horizon": m["horizon"],
            "subset": m["subset"],
            "method": m["metode"],
            "n": m["n"],
            "mae_kmh": round(m["MAE (mph)"] * 1.609344, 2),
            "rmse_kmh": round(m["RMSE (mph)"] * 1.609344, 2),
            "macro_f1": m["macro-F1 level"],
            "recall_congested": m["recall macet"],
            "precision_congested": m["precision macet"],
        }
        for m in b["test_metrics"]
    ]
    return {
        "yolo": {
            "model": y["model"],
            "classes": y["classes"],
            "map50": tm["mAP50"],
            "map50_95": tm["mAP50-95"],
            "precision": tm["precision"],
            "recall": tm["recall"],
            "per_class": y["per_class"],
        },
        "model_a": {
            "model": a["model"],
            "features": a["features"],
            "classes": a["classes"],
            "display": a["display"],
            "window_s": a["window_s"],
            "step_s": a["step_s"],
            "cv_results": a["cv_results"],
            "class_medians": ref.class_medians,
            "n_clips": ref.n_ucsd_clips,
        },
        "model_b": {
            "features": b["features"],
            "weather": bool(b.get("weather")),
            "best_iteration": b["best_iteration"],
            "train": b["train"],
            "val": b["val"],
            "test": b["test"],
            "test_metrics": test_metrics,
        },
        "importance_1h": ref.importance_1h,
        "importance_3h": ref.importance_3h,
    }
