from fastapi import APIRouter

from .. import queries
from ..context import Ctx
from ..schemas import MetaSensor

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/sensors", response_model=list[MetaSensor])
def sensors(ctx: Ctx):
    return queries.meta_sensors(ctx.ref)
