"""Copy notebook outputs & test videos into dashboard/data/ (PLAN §6).

Sources (../Output IPYNB, ../Dataset) are READ-ONLY: this script only reads them.
Each copied file is verified by size + MD5. Re-running skips files that already match.

Usage (from dashboard/):  python scripts/copy_data.py [--no-video] [--force]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parent.parent
ROOT = DASHBOARD.parent  # Projek Akhir/
OUT = ROOT / "Output IPYNB"
DATASET = ROOT / "Dataset"
DATA = DASHBOARD / "data"

BATCH = OUT / "01_batch"
YOLO = OUT / "02_yolo-Quick Test False" / "02_yolo"
MODEL_A = OUT / "03_model_a-20261028T112404Z-1-001" / "03_model_a"
MODEL_B = OUT / "04_model_b-20261028T122005Z-1-001" / "04_model_b"

# (destination relative to data/, source file). Directories are expanded below.
FILES: list[tuple[str, Path]] = [
    ("batch/bv_hotspots.csv", BATCH / "bv_hotspots.csv"),
    ("batch/bv_network_daily.csv", BATCH / "bv_network_daily.csv"),
    ("batch/bv_sensor_profile.csv", BATCH / "bv_sensor_profile.csv"),
    ("batch/ref_sensor_meta.csv", BATCH / "ref_sensor_meta.csv"),
    ("batch/ref_free_flow_speed.csv", BATCH / "ref_free_flow_speed.csv"),
    ("model_b/forecasts_june.parquet", MODEL_B / "forecasts_june.parquet"),
    ("model_b/profile_train.parquet", MODEL_B / "profile_train.parquet"),
    ("model_b/vff_train.csv", MODEL_B / "vff_train.csv"),
    ("model_b/model_b_config.json", MODEL_B / "model_b_config.json"),
    ("model_b/latest_forecast.csv", MODEL_B / "latest_forecast.csv"),
    ("model_b/weather_open_meteo.csv", MODEL_B / "weather_open_meteo.csv"),
    ("model_b/model_b_1h.joblib", MODEL_B / "model_b_1h.joblib"),
    ("model_b/model_b_3h.joblib", MODEL_B / "model_b_3h.joblib"),
    ("model_a/model_a.joblib", MODEL_A / "model_a.joblib"),
    ("model_a/model_a_config.json", MODEL_A / "model_a_config.json"),
    ("model_a/timeline_video_uji.csv", MODEL_A / "timeline_video_uji.csv"),
    ("model_a/ucsd_features.csv", MODEL_A / "ucsd_features.csv"),
    ("yolo/yolov8s_traffic7.pt", YOLO / "yolov8s_traffic7.pt"),
    ("yolo/yolov8s_traffic7_info.json", YOLO / "yolov8s_traffic7_info.json"),
]

VIDEOS: list[tuple[str, Path]] = [
    ("video/video_uji.mp4", DATASET / "video_uji.mp4"),
    # Names without spaces so they are safe in URLs / shell commands.
    ("video/extra/video_uji_dashboard_3.mp4", DATASET / "Video Uji Dashboard 3.mp4"),
    ("video/extra/14025968_2160_3840_29fps.mp4", DATASET / "14025968_2160_3840_29fps.mp4"),
    ("video/extra/2103099-uhd_3840_2160_30fps.mp4", DATASET / "2103099-uhd_3840_2160_30fps.mp4"),
]


def parquet_dir(dest: str, src_dir: Path) -> list[tuple[str, Path]]:
    """Expand a Spark/pyarrow output dir to its *.parquet files (skip _SUCCESS / .crc)."""
    return [
        (f"{dest}/{p.relative_to(src_dir).as_posix()}", p)
        for p in sorted(src_dir.rglob("*.parquet"))
        if not p.name.startswith(".")
    ]


def md5(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fmt_size(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:,.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024
    return f"{n:.1f} GB"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-video", action="store_true", help="skip the test videos (~435 MB)")
    ap.add_argument("--force", action="store_true", help="copy even if destination already matches")
    args = ap.parse_args()

    plan = (
        parquet_dir("batch/master", BATCH / "master_pemsbay")
        + parquet_dir("batch/bv_sensor_hourly", BATCH / "batch_views" / "bv_sensor_hourly")
        + FILES
        + ([] if args.no_video else VIDEOS)
    )

    missing = [src for _, src in plan if not src.is_file()]
    if missing:
        print("ERROR: sumber tidak ditemukan:", file=sys.stderr)
        for m in missing:
            print(f"  - {m}", file=sys.stderr)
        return 1

    groups: dict[str, list[int]] = {}  # top-level folder -> [n_files, bytes]
    copied = skipped = 0
    for dest_rel, src in plan:
        dest = DATA / dest_rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        src_size = src.stat().st_size
        if not args.force and dest.is_file() and dest.stat().st_size == src_size and md5(dest) == md5(src):
            skipped += 1
        else:
            shutil.copy2(src, dest)
            if dest.stat().st_size != src_size or md5(dest) != md5(src):
                print(f"ERROR: verifikasi gagal untuk {dest_rel}", file=sys.stderr)
                return 1
            copied += 1
            print(f"  salin  {dest_rel}  ({fmt_size(src_size)})")
        g = groups.setdefault(dest_rel.split("/")[0], [0, 0])
        g[0] += 1
        g[1] += src_size

    print("\nRingkasan dashboard/data/:")
    print(f"  {'folder':<10} {'file':>5} {'ukuran':>12}")
    for name, (n, size) in sorted(groups.items()):
        print(f"  {name:<10} {n:>5} {fmt_size(size):>12}")
    total = sum(s for _, s in groups.values())
    print(f"  {'TOTAL':<10} {sum(n for n, _ in groups.values()):>5} {fmt_size(total):>12}")
    print(f"\n{copied} disalin, {skipped} sudah cocok (MD5) dan dilewati.")

    # Facts about the raw dataset the API can't see by itself (Dataset/ is not mounted in Docker)
    raw_csv = DATASET / "PEMS-BAY.csv"
    manifest = {"raw_csv": raw_csv.name, "raw_csv_bytes": raw_csv.stat().st_size if raw_csv.is_file() else None}
    (DATA / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"manifest.json: {manifest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
