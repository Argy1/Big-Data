"""WebSocket fan-out for /ws/live (PLAN §8.1, §8.3).

Messages: {"type":"tick", ts, kpi} · {"type":"replay", running, ...} · {"type":"camera", ...}.
The Redis subscriber for camera events is added in Fase 5.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    @property
    def count(self) -> int:
        return len(self._clients)

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)

    async def send(self, ws: WebSocket, message: dict[str, Any]) -> None:
        await ws.send_json(jsonable_encoder(message))

    async def broadcast(self, message: dict[str, Any]) -> None:
        payload = jsonable_encoder(message)
        async with self._lock:
            clients = list(self._clients)
        dead = []
        for ws in clients:
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001 - a closed socket just gets dropped
                dead.append(ws)
        if dead:
            async with self._lock:
                self._clients.difference_update(dead)
