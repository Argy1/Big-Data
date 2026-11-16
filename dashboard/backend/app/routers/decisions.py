import json
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from ..context import Ctx
from ..db import Decision, Session, select
from ..schemas import DecisionIn, DecisionOut, DecisionRow

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


def _utc(dt: datetime) -> datetime:
    """created_at is stored as naive UTC; send it with its zone so clients can localise it."""
    return dt.replace(tzinfo=UTC)


@router.post("", response_model=DecisionOut, status_code=201)
def create_decision(body: DecisionIn, ctx: Ctx):
    if body.sensor_id not in ctx.ref.sensors.index:
        raise HTTPException(404, f"sensor {body.sensor_id} tidak ditemukan")
    row = Decision(sensor_id=body.sensor_id, ts=body.ts, actions=json.dumps(body.actions), note=body.note)
    with Session(ctx.engine) as s:
        s.add(row)
        s.commit()
        s.refresh(row)
    return {"id": row.id, "created_at": _utc(row.created_at)}


@router.get("", response_model=list[DecisionRow])
def list_decisions(ctx: Ctx, sensor_id: int | None = None):
    with Session(ctx.engine) as s:
        q = select(Decision).order_by(Decision.created_at.desc(), Decision.id.desc())
        if sensor_id is not None:
            q = q.where(Decision.sensor_id == sensor_id)
        rows = s.exec(q).all()
    return [
        {**r.model_dump(exclude={"actions", "created_at"}), "actions": json.loads(r.actions), "created_at": _utc(r.created_at)}
        for r in rows
    ]
