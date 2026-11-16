"""ReplayClock: replays June 2017 as if it were live (PLAN §8.2).

One tick = +15 minutes, every `tick_seconds` real seconds while playing. Stops at the end
of the data. Every change of time calls on_tick(ts); play/pause calls on_state(running).
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta

STEP = timedelta(minutes=15)


def _floor_15(ts: datetime) -> datetime:
    return ts.replace(minute=ts.minute - ts.minute % 15, second=0, microsecond=0)


class ReplayClock:
    def __init__(
        self,
        start: datetime,
        min_ts: datetime,
        max_ts: datetime,
        tick_seconds: float,
        on_tick: Callable[[datetime], Awaitable[None]] | None = None,
        on_state: Callable[[bool], Awaitable[None]] | None = None,
    ):
        self.min_ts, self.max_ts = min_ts, max_ts
        self.ts = self._clamp(start)
        self.tick_seconds = tick_seconds
        self.running = False
        self._on_tick = on_tick
        self._on_state = on_state
        self._task: asyncio.Task | None = None

    def _clamp(self, ts: datetime) -> datetime:
        return min(max(_floor_15(ts), self.min_ts), self.max_ts)

    def state(self) -> dict:
        return {
            "ts": self.ts,
            "running": self.running,
            "tick_seconds": self.tick_seconds,
            "min_ts": self.min_ts,
            "max_ts": self.max_ts,
        }

    async def _set_ts(self, ts: datetime) -> None:
        new = self._clamp(ts)
        if new != self.ts:
            self.ts = new
        # broadcast even when unchanged, so a client that pressed "step" at the edge gets a reply
        if self._on_tick:
            await self._on_tick(self.ts)

    async def _set_running(self, running: bool) -> None:
        self.running = running
        if self._on_state:
            await self._on_state(running)

    async def play(self) -> None:
        if self.running:
            return
        if self.ts >= self.max_ts:  # at the end: restart from the beginning of the data
            await self._set_ts(self.min_ts)
        await self._set_running(True)
        self._task = asyncio.create_task(self._loop())

    async def pause(self) -> None:
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None
        if self.running:
            await self._set_running(False)

    async def seek(self, ts: datetime) -> None:
        await self._set_ts(ts)

    async def step(self, steps: int = 1) -> None:
        await self._set_ts(self.ts + steps * STEP)

    def set_tick_seconds(self, seconds: float) -> None:
        self.tick_seconds = max(0.2, float(seconds))

    async def _loop(self) -> None:
        while True:
            await asyncio.sleep(self.tick_seconds)
            if self.ts >= self.max_ts:  # end of June: stop by itself
                self._task = None
                await self._set_running(False)
                return
            await self._set_ts(self.ts + STEP)

    async def close(self) -> None:
        await self.pause()
