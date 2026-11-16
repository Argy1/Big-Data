"""Runtime settings, read from environment variables (see ../.env.example)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

_DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def _env(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


@dataclass(frozen=True)
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(_env("DATA_DIR", str(_DEFAULT_DATA_DIR))).resolve())
    redis_url: str = field(default_factory=lambda: _env("REDIS_URL", "redis://localhost:6379/0"))
    replay_start: datetime = field(
        default_factory=lambda: datetime.fromisoformat(_env("REPLAY_START", "2017-06-07T16:45:00"))
    )
    tick_seconds: float = field(default_factory=lambda: float(_env("TICK_SECONDS", "5")))
    # SQLite for decisions/cameras. Kept outside data/ because the API never writes there.
    app_db: Path = field(
        default_factory=lambda: Path(_env("APP_DB", str(_DEFAULT_DATA_DIR.parent / "appdata" / "arus.sqlite")))
    )
    # Uploaded camera videos; shared with the worker (same folder on disk, also outside Docker)
    upload_dir: Path = field(
        default_factory=lambda: Path(_env("UPLOAD_DIR", str(_DEFAULT_DATA_DIR.parent / "appdata" / "uploads")))
    )
    max_upload_mb: int = field(default_factory=lambda: int(_env("MAX_UPLOAD_MB", "300")))
    cors_origins: list[str] = field(
        default_factory=lambda: [o.strip() for o in _env("CORS_ORIGINS", "http://localhost:3000").split(",")]
    )


settings = Settings()

# Files the API needs to serve every page (relative to data_dir). Used by /api/health.
REQUIRED_FILES = [
    "batch/bv_hotspots.csv",
    "batch/bv_network_daily.csv",
    "batch/bv_sensor_profile.csv",
    "batch/ref_sensor_meta.csv",
    "batch/ref_free_flow_speed.csv",
    "model_b/forecasts_june.parquet",
    "model_b/profile_train.parquet",
    "model_b/vff_train.csv",
    "model_b/model_b_config.json",
    "model_a/model_a_config.json",
    "model_a/ucsd_features.csv",
    "yolo/yolov8s_traffic7_info.json",
]
REQUIRED_DIRS = ["batch/master", "batch/bv_sensor_hourly"]
