"""Fase 0: data present, models load without version warnings, /api/health contract."""

import warnings

import joblib
import pytest

from app.config import settings
from app.main import check_data
from app.model_store import JOBLIB_FILES


def test_data_present():
    assert check_data() == []


@pytest.mark.parametrize("name", sorted(JOBLIB_FILES))
def test_joblib_loads_without_version_warning(name):
    # Our own Colab outputs (trusted). Any warning, e.g. InconsistentVersionWarning, fails the test.
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        model = joblib.load(settings.data_dir / JOBLIB_FILES[name])
    assert model is not None


def test_model_a_classes_by_name():
    # PLAN §7: class order in model_a.joblib is ["heavy","light","medium"]; map by name.
    model = joblib.load(settings.data_dir / JOBLIB_FILES["model_a"])
    assert list(model.classes_) == ["heavy", "light", "medium"]


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["data_ok"] is True
    assert body["models"]["model_a"] is True
    assert body["models"]["model_b_1h"] is True
    assert body["models"]["model_b_3h"] is True
    assert body["models"]["yolo_ft"] is True
    assert isinstance(body["redis_ok"], bool)
