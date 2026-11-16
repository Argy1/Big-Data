from datetime import date, datetime

from fastapi import APIRouter, HTTPException

from .. import queries
from ..context import Ctx
from ..schemas import SensorDetail, SensorSeries

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("/{sensor_id}", response_model=SensorDetail)
def sensor(sensor_id: int, ctx: Ctx, ts: datetime | None = None):
    try:
        return queries.sensor_detail(ctx.batch, ctx.ref, sensor_id, ts or ctx.replay.ts)
    except queries.NotFound as exc:
        raise HTTPException(404, str(exc)) from exc


@router.get("/{sensor_id}/series", response_model=SensorSeries)
def sensor_series(sensor_id: int, ctx: Ctx, date: date | None = None, ts: datetime | None = None):
    now = ts or ctx.replay.ts
    try:
        return queries.sensor_series(ctx.batch, ctx.ref, sensor_id, date or now.date(), now)
    except queries.NotFound as exc:
        raise HTTPException(404, str(exc)) from exc
