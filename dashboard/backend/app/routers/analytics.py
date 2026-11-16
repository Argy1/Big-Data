from fastapi import APIRouter, Query

from .. import queries
from ..context import Ctx
from ..schemas import DailyRow, Heatmap, Hotspot, Summary

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary", response_model=Summary)
def summary(ctx: Ctx):
    return queries.summary(ctx.batch, ctx.ref)


@router.get("/heatmap", response_model=Heatmap)
def heatmap(ctx: Ctx):
    return queries.heatmap(ctx.batch)


@router.get("/daily", response_model=list[DailyRow])
def daily(ctx: Ctx):
    return queries.daily(ctx.batch)


@router.get("/hotspots", response_model=list[Hotspot])
def hotspots(ctx: Ctx, limit: int = Query(8, ge=1, le=325)):
    return queries.hotspots(ctx.batch, ctx.ref, limit)
