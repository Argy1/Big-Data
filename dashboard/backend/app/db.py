"""DuckDB over the batch views (read-only) + SQLite for app data (decisions).

DuckDB: the small views (forecasts 0.9 M rows, profiles, daily, hotspots) are loaded once
into an in-memory database; the source Parquet/CSV files are only ever read. The 16.9 M-row
master dataset stays a view over the Parquet files (only used for summary counts).
Each request gets its own cursor, so queries from FastAPI's thread pool don't collide.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from pathlib import Path

import duckdb
import pandas as pd
from pydantic import NaiveDatetime
from sqlmodel import Field, Session, SQLModel, create_engine, select

# table name -> (SQL source, materialize into memory?)
_SOURCES = {
    "forecasts": ("read_parquet('{d}/model_b/forecasts_june.parquet')", True),
    "vff": ("read_csv_auto('{d}/model_b/vff_train.csv')", True),
    "meta": ("read_csv_auto('{d}/batch/ref_sensor_meta.csv')", True),
    "hotspots": ("read_csv_auto('{d}/batch/bv_hotspots.csv')", True),
    "daily": ("read_csv_auto('{d}/batch/bv_network_daily.csv')", True),
    "sensor_profile": ("read_csv_auto('{d}/batch/bv_sensor_profile.csv')", True),
    "master": ("read_parquet('{d}/batch/master/*/*.parquet')", False),
}


class Batch:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self._con = duckdb.connect(":memory:")
        self._lock = threading.Lock()
        d = data_dir.as_posix()
        for name, (src, materialize) in _SOURCES.items():
            kind = "TABLE" if materialize else "VIEW"
            self._con.execute(f"CREATE {kind} {name} AS SELECT * FROM {src.format(d=d)}")
        # forecasts: nanosecond timestamps -> plain TIMESTAMP, index for per-ts lookups
        self._con.execute("ALTER TABLE forecasts ALTER timestamp TYPE TIMESTAMP")
        self._con.execute("CREATE INDEX idx_fc_ts ON forecasts(timestamp)")

    def df(self, sql: str, params: list | None = None) -> pd.DataFrame:
        with self._lock:
            cur = self._con.cursor()
        try:
            return cur.execute(sql, params or []).df()
        finally:
            cur.close()

    def one(self, sql: str, params: list | None = None) -> tuple | None:
        with self._lock:
            cur = self._con.cursor()
        try:
            return cur.execute(sql, params or []).fetchone()
        finally:
            cur.close()


# ---------------------------------------------------------------- SQLite (app data)


class Decision(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    sensor_id: int = Field(index=True)
    ts: NaiveDatetime  # replay time the decision refers to (naive, California local)
    actions: str  # JSON-encoded list of action strings
    note: str | None = None
    # real wall-clock time of the operator, stored as naive UTC (SQLite has no time zones);
    # the API returns it with "+00:00" so the browser shows it in the viewer's local time
    created_at: NaiveDatetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


class Camera(SQLModel, table=True):
    id: str = Field(primary_key=True)  # "CAM-01", "CAM-02", …
    name: str
    # "data:video/video_uji.mp4" or "uploads:<file>": resolved against DATA_DIR / UPLOAD_DIR by each
    # process, so the API (in Docker) and the worker (in Docker or on Windows) agree on the file
    source: str
    detector_mode: str = "auto"  # auto | coco | finetuned
    original_filename: str | None = None
    created_at: NaiveDatetime = Field(default_factory=lambda: datetime.now(UTC).replace(tzinfo=None))


def make_engine(db_path: Path):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return engine


__all__ = ["Batch", "Camera", "Decision", "Session", "make_engine", "select"]
