import os
from pathlib import Path

# Tests run on CPU so the project also works on machines without a GPU (PLAN §3.1).
os.environ.setdefault("WORKER_DEVICE", "cpu")

DASHBOARD = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR", DASHBOARD / "data"))
# UCSD clips are read straight from the (read-only) Dataset folder; never copied or modified.
UCSD_DIR = Path(os.environ.get("UCSD_DIR", DASHBOARD.parent / "Dataset" / "archive (2)"))
