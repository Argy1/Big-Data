from fastapi import APIRouter, HTTPException

from ..context import Ctx
from ..schemas import ReplayAction, ReplayState

router = APIRouter(prefix="/api/replay", tags=["replay"])


@router.get("", response_model=ReplayState)
def get_replay(ctx: Ctx):
    return ctx.replay.state()


@router.post("", response_model=ReplayState)
async def post_replay(body: ReplayAction, ctx: Ctx):
    clock = ctx.replay
    if body.tick_seconds is not None:
        clock.set_tick_seconds(body.tick_seconds)
    match body.action:
        case "play":
            await clock.play()
        case "pause":
            await clock.pause()
        case "step":
            await clock.step(body.steps)
        case "seek":
            if body.ts is None:
                raise HTTPException(422, "seek butuh ts")
            await clock.seek(body.ts)
    return clock.state()
