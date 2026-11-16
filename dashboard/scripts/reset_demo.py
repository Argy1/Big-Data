"""Put the dashboard back in its demo starting state (README "Skenario demo").

  * deletes every recorded decision (the E2E flow test writes real ones into appdata/arus.sqlite);
  * deletes uploaded cameras, so only CAM-01 is left (their video files go with them);
  * pauses the replay and puts it back at Rab, 7 Jun 2017 16:45.

The stack must be running (docker compose up). Standard library only.

Usage (from dashboard/):  python scripts/reset_demo.py [--api http://localhost:8000]
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import urllib.error
import urllib.request
from pathlib import Path

DASHBOARD = Path(__file__).resolve().parent.parent
DB = DASHBOARD / "appdata" / "arus.sqlite"
DEFAULT_CAMERA = "CAM-01"
DEMO_START = "2017-06-07T16:45:00"


def call(api: str, method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{api}{path}", data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as res:
        raw = res.read()
    return json.loads(raw) if raw else None


def clear_decisions() -> int:
    if not DB.exists():
        return 0
    with sqlite3.connect(DB) as con:
        if not con.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='decision'").fetchone():
            return 0
        n = con.execute("DELETE FROM decision").rowcount
    return n


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api", default="http://localhost:8000")
    api = parser.parse_args().api.rstrip("/")

    try:
        call(api, "GET", "/api/health")
    except (urllib.error.URLError, OSError) as exc:
        print(f"API tidak bisa dihubungi di {api} ({exc}). Jalankan dulu: docker compose up -d")
        return 1

    n_decisions = clear_decisions()
    print(f"Keputusan dihapus      : {n_decisions}")

    removed = []
    for cam in call(api, "GET", "/api/cameras"):
        if cam["id"] != DEFAULT_CAMERA:
            call(api, "DELETE", f"/api/cameras/{cam['id']}")
            removed.append(cam["id"])
    print(f"Kamera unggahan dihapus: {', '.join(removed) or '-'}")

    call(api, "POST", "/api/replay", {"action": "pause"})
    state = call(api, "POST", "/api/replay", {"action": "seek", "ts": DEMO_START})

    left = [c["id"] for c in call(api, "GET", "/api/cameras")]
    decisions = call(api, "GET", "/api/decisions")
    print(f"Kamera tersisa         : {', '.join(left)}")
    print(f"Keputusan tersimpan    : {len(decisions)}")
    print(f"Waktu replay           : {state['ts']} ({'berjalan' if state['running'] else 'dijeda'})")
    ok = not decisions and left == [DEFAULT_CAMERA] and state["ts"].startswith(DEMO_START) and not state["running"]
    print("Siap demo." if ok else "PERHATIAN: reset belum lengkap, cek pesan di atas.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
