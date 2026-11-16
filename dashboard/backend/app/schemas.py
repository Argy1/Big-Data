"""Pydantic models = the API contract (PLAN §8). All speeds in km/jam, times naive (California local)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

Level = int  # 0 Lancar · 1 Melambat · 2 Padat · 3 Macet


class MetaSensor(BaseModel):
    sensor_id: int
    name: str
    name_raw: str
    fwy: int
    dir: str
    fwy_label: str
    lanes: int
    lat: float
    lon: float
    x: float
    y: float
    vff_kmh: float


class ReplayState(BaseModel):
    ts: datetime
    running: bool
    tick_seconds: float
    min_ts: datetime
    max_ts: datetime


class ReplayAction(BaseModel):
    action: Literal["play", "pause", "seek", "step"]
    ts: datetime | None = None
    steps: int = 1
    tick_seconds: float | None = Field(default=None, gt=0)


class Kpi(BaseModel):
    avg_speed: float | None
    normal_speed: float | None
    normal_hour: int
    congested_now: int
    congested_1h: int
    congested_3h: int
    normal_congested_pct: float | None
    worse_1h: int
    better_1h: int
    alerts_1h: int
    n_sensors: int


class Counts(BaseModel):
    now: list[int]
    h1: list[int]
    h3: list[int]


class SnapshotSensor(BaseModel):
    sensor_id: int
    speed_now: float | None
    level_now: Level | None
    pred_1h: float | None
    level_1h: Level | None
    pred_3h: float | None
    level_3h: Level | None


class Snapshot(BaseModel):
    ts: datetime
    kpi: Kpi
    counts: Counts
    sensors: list[SnapshotSensor]


class Series(BaseModel):
    date: date
    actual: list[list[float]]
    pred_1h: list[list[float]]
    pred_3h: list[list[float]]
    profile: list[list[float]]
    now: float | None


class SensorSeries(Series):
    vff: float


class Alert(BaseModel):
    sensor_id: int
    name: str
    fwy: int
    dir: str
    fwy_label: str
    speed_now: float
    pred: float
    level_now: Level
    level_pred: Level
    drop: float


class HorizonPoint(BaseModel):
    ts: datetime
    speed: float | None
    ratio: float | None
    level: Level | None
    profile: float | None  # normal speed (bv_sensor_profile) at this weekday & hour


class SensorDetail(BaseModel):
    sensor_id: int
    name: str
    name_raw: str
    fwy: int
    dir: str
    fwy_label: str
    lanes: int
    lat: float
    lon: float
    vff_kmh: float
    now: HorizonPoint
    h1: HorizonPoint
    h3: HorizonPoint


class Summary(BaseModel):
    n_readings: int
    n_days: int
    n_sensors: int
    first_date: date
    last_date: date
    pct_congested_mean: float
    pct_congested_max: float
    master_mb: float
    raw_csv_mb: float | None  # Dataset/PEMS-BAY.csv, recorded by scripts/copy_data.py
    r2_profile: float  # share of speed variance explained by the routine (sensor × weekday × hour) profile
    holidays: list[date]


class Heatmap(BaseModel):
    days: list[str]
    hours: list[int]
    values: list[list[float]]


class DailyRow(BaseModel):
    date: date
    pct_congested: float
    avg_speed: float | None


class Hotspot(BaseModel):
    rank: int
    sensor_id: int
    name: str
    fwy: int
    dir: str
    fwy_label: str
    pct_congested: float
    pct_severe: float
    avg_speed: float | None


class ModelMetrics(BaseModel):
    yolo: dict[str, Any]
    model_a: dict[str, Any]
    model_b: dict[str, Any]
    importance_1h: list[dict[str, Any]]
    importance_3h: list[dict[str, Any]]


class DecisionIn(BaseModel):
    sensor_id: int
    ts: datetime
    actions: list[str] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=1000)


class DecisionOut(BaseModel):
    id: int
    created_at: datetime


class DecisionRow(BaseModel):
    id: int
    sensor_id: int
    ts: datetime
    actions: list[str]
    note: str | None
    created_at: datetime
