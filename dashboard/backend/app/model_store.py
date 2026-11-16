"""Load the Colab-trained .joblib models once and record any version warnings.

The models were pickled in Colab, so scikit-learn / lightgbm here must match those
versions exactly (PLAN §3). A mismatch shows up as sklearn's InconsistentVersionWarning;
we capture it instead of letting it scroll by, and expose it via /api/health.

Security: joblib = pickle, so only load these project-owned files produced by our own
Colab notebooks (copied by scripts/copy_data.py). Never point this at uploaded files.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib

JOBLIB_FILES = {
    "model_a": "model_a/model_a.joblib",
    "model_b_1h": "model_b/model_b_1h.joblib",
    "model_b_3h": "model_b/model_b_3h.joblib",
}


@dataclass
class LoadResult:
    model: Any = None
    error: str | None = None
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.model is not None and self.error is None and not self.warnings


def load_joblib(path: Path) -> LoadResult:
    if not path.is_file():
        return LoadResult(error=f"file tidak ada: {path.name}")
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            model = joblib.load(path)
        except Exception as exc:  # noqa: BLE001 - report any load failure in /health
            return LoadResult(error=f"{type(exc).__name__}: {exc}")
    return LoadResult(model=model, warnings=[f"{w.category.__name__}: {w.message}" for w in caught])


def load_all(data_dir: Path) -> dict[str, LoadResult]:
    return {name: load_joblib(data_dir / rel) for name, rel in JOBLIB_FILES.items()}
