import os
import tempfile
from pathlib import Path

import pytest

# Isolate the SQLite decision log per test session (must be set before app.config is imported).
_TMP = Path(tempfile.mkdtemp(prefix="arus-test-"))
os.environ.setdefault("APP_DB", str(_TMP / "arus.sqlite"))
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:1/0")  # unreachable on purpose: tests don't need Redis
os.environ.setdefault("TICK_SECONDS", "5")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

DEMO_TS = "2017-06-07T16:45:00"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_replay(client):
    """Each test starts paused at the default replay time."""
    clock = app.state.ctx.replay
    client.post("/api/replay", json={"action": "pause"})
    client.post("/api/replay", json={"action": "seek", "ts": DEMO_TS, "tick_seconds": 5})
    yield
    client.post("/api/replay", json={"action": "pause"})
    assert not clock.running
