from datetime import date, datetime

from fastapi import APIRouter, Query

from .. import queries
from ..context import Ctx
from ..schemas import Alert, Series, Snapshot

router = APIRouter(prefix="/api", tags=["network"])


@router.get("/network/snapshot", response_model=Snapshot)
def snapshot(ctx: Ctx, ts: datetime | None = None):
    return queries.snapshot(ctx.batch, ctx.ref, ts or ctx.replay.ts)


@router.get("/network/series", response_model=Series)
def series(ctx: Ctx, date: date | None = None, ts: datetime | None = None):
    """Network mean per 15 min for one day. Only origins up to `ts` (default: replay time) are shown."""
    now = ts or ctx.replay.ts
    return queries.network_series(ctx.batch, ctx.ref, date or now.date(), now)


@router.get("/alerts", response_model=list[Alert])
def alerts(
    ctx: Ctx,
    ts: datetime | None = None,
    horizon: str = Query("1h", pattern="^(1h|3h)$"),
    limit: int = Query(6, ge=1, le=325),
):
    return queries.alerts(ctx.batch, ctx.ref, ts or ctx.replay.ts, horizon, limit)
