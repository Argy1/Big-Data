"""Shared app state, built in main.lifespan and handed to routers via `Ctx` dependency."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request

from .db import Batch
from .model_store import LoadResult
from .refdata import RefData
from .replay import ReplayClock
from .ws import ConnectionManager


@dataclass
class AppContext:
    batch: Batch
    ref: RefData
    replay: ReplayClock
    ws: ConnectionManager
    engine: Any  # SQLAlchemy engine (SQLite)
    models: dict[str, LoadResult]


def get_ctx(request: Request) -> AppContext:
    ctx = getattr(request.app.state, "ctx", None)
    if ctx is None:
        raise HTTPException(503, "data belum dimuat (cek /api/health)")
    return ctx


Ctx = Annotated[AppContext, Depends(get_ctx)]
