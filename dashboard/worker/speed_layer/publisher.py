"""Redis contract between worker (speed layer) and API (serving layer). The API never talks to the
worker directly and the worker never talks to browsers (PLAN §4).

  cam:ids              SET   camera ids to run                      (API writes)
  cam:cfg:{id}         HASH  name, source, detector_mode            (API writes)
  cam:state:{id}       HASH  status, device, detector, scores, size (worker writes, expires)
  camera:{id}          STREAM one entry per 5 s window, field "data" = JSON (worker XADD)
  frame:{id}           STRING latest annotated JPEG (worker SET, expires)
  frame:{id}:seq       INT   increments with every frame, so the MJPEG proxy knows when to send
"""

from __future__ import annotations

import json
import time
from typing import Any

import redis

STATE_TTL_S = 15
FRAME_TTL_S = 10
STREAM_MAXLEN = 500


class Publisher:
    def __init__(self, r: redis.Redis, camera_id: str):
        self.r = r
        self.id = camera_id

    def config(self) -> dict[str, str]:
        return {k.decode(): v.decode() for k, v in self.r.hgetall(f"cam:cfg:{self.id}").items()}

    def state(self, **fields: Any) -> None:
        key = f"cam:state:{self.id}"
        data = {k: (json.dumps(v) if isinstance(v, (dict, list)) else str(v)) for k, v in fields.items()}
        data["updated"] = f"{time.time():.3f}"
        pipe = self.r.pipeline()
        pipe.hset(key, mapping=data)
        pipe.expire(key, STATE_TTL_S)
        pipe.execute()

    def window(self, payload: dict[str, Any]) -> None:
        self.r.xadd(f"camera:{self.id}", {"data": json.dumps(payload)}, maxlen=STREAM_MAXLEN, approximate=True)

    def frame(self, jpeg: bytes) -> None:
        pipe = self.r.pipeline()
        pipe.set(f"frame:{self.id}", jpeg, ex=FRAME_TTL_S)
        pipe.incr(f"frame:{self.id}:seq")
        pipe.expire(f"cam:state:{self.id}", STATE_TTL_S)
        pipe.execute()
