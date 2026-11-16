from fastapi import APIRouter

from .. import queries
from ..context import Ctx
from ..schemas import ModelMetrics

router = APIRouter(prefix="/api/models", tags=["models"])


@router.get("/metrics", response_model=ModelMetrics)
def metrics(ctx: Ctx):
    return queries.model_metrics(ctx.ref)
