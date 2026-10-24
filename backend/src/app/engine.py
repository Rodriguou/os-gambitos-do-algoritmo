"""Chess engine abstraction: a Stockfish adapter and a process pool.

The rest of the app talks to the ChessEngine protocol instead of to
python-chess directly, so the engine stays swappable and the service
remains unit-testable with a fake implementation.
"""

from __future__ import annotations

import asyncio
import math
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Protocol, runtime_checkable

import chess
import chess.engine

from app.config import Settings


@dataclass(frozen=True, kw_only=True)
class ScoredMove:
    """A move plus its evaluation, from the perspective of the side to move."""

    move: chess.Move
    score_cp: int | None = None
    mate_in: int | None = None
    win_rate: float | None = None
    depth: int = 0
    pv: list[chess.Move]


@dataclass(frozen=True, kw_only=True)
class EngineAnalysis:
    """Result of a Multi-PV analysis, best move first."""

    moves: list[ScoredMove]


MATE_SCORE = 100_000

# Same logistic curve used by the frontend advantage bar (vantagem.js). It is
# the single source of truth for win probability: Stockfish's own WDL is much
# steeper (e.g. +2.0 reads as ~99%) and would contradict the bar.
WIN_RATE_SLOPE = 0.00368208


def win_rate_from_score(score_cp: int) -> float:
    """Approximate win probability (0..1) from a centipawn score."""
    return 1 / (1 + math.exp(-WIN_RATE_SLOPE * score_cp))


def win_rate_from_eval(score_cp: int | None, mate_in: int | None) -> float | None:
    """Win probability for the side to move; only a forced mate hits 0% or 100%."""
    if mate_in is not None:
        return 1.0 if mate_in > 0 else 0.0
    if score_cp is None:
        return None
    return win_rate_from_score(score_cp)


def score_value(move: ScoredMove) -> int:
    """Numeric evaluation of a scored move, converting mates to a large score."""
    if move.mate_in is not None:
        if move.mate_in > 0:
            return MATE_SCORE - move.mate_in
        return -(MATE_SCORE + move.mate_in)
    return move.score_cp or 0


@dataclass(frozen=True, kw_only=True)
class PlayedMove:
    """A move chosen by the engine, with its evaluation."""

    move: chess.Move
    score_cp: int | None = None
    mate_in: int | None = None


@runtime_checkable
class ChessEngine(Protocol):
    """Async interface for a chess engine."""

    async def analyse(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        multi_pv: int,
    ) -> EngineAnalysis:
        """Analyse fen and return up to multi_pv scored moves."""
        ...

    async def play(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        skill_level: int,
    ) -> PlayedMove:
        """Choose a move for the side to move on fen."""
        ...

    async def close(self) -> None:
        """Release all engine resources."""
        ...


def _score_fields(score: chess.engine.PovScore) -> tuple[int | None, int | None]:
    """Split a PovScore into (score_cp, mate_in)."""
    relative = score.relative
    if isinstance(relative, chess.engine.Mate):
        return None, relative.moves
    return relative.score(), None


def _scored_move(move: chess.Move, info: chess.engine.InfoDict) -> ScoredMove:
    """Convert one Stockfish info entry into a ScoredMove."""
    score_cp: int | None = None
    mate_in: int | None = None
    score = info.get("score")
    if isinstance(score, chess.engine.PovScore):
        score_cp, mate_in = _score_fields(score)
    return ScoredMove(
        move=move,
        score_cp=score_cp,
        mate_in=mate_in,
        win_rate=win_rate_from_eval(score_cp, mate_in),
        depth=info.get("depth") or 0,
        pv=list(info.get("pv") or []),
    )


class StockfishEngine:
    """Adapter that owns one Stockfish process via python-chess.

    Stockfish's API is synchronous, so every call is dispatched to a
    worker thread to keep the FastAPI event loop free.
    """

    def __init__(self, path: str) -> None:
        self._engine = chess.engine.SimpleEngine.popen_uci(path)

    async def analyse(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        multi_pv: int,
    ) -> EngineAnalysis:
        """Run a bounded search on fen and return the top moves."""

        def _run() -> EngineAnalysis:
            board = chess.Board(fen)
            results = self._engine.analyse(
                board,
                chess.engine.Limit(depth=depth, time=max_time_ms / 1000.0),
                multipv=multi_pv,
            )
            # multipv is always set, so the engine returns a list.
            moves: list[ScoredMove] = []
            for info in results:
                pv = info.get("pv")
                if pv:
                    moves.append(_scored_move(pv[0], info))
            # python-chess may report the lines at slightly different
            # depths, so the engine order is not guaranteed to be sorted
            # by score. Sorting here keeps "best move" and "best
            # alternative" consistent even when the time cap kicks in.
            moves.sort(key=score_value, reverse=True)
            return EngineAnalysis(moves=moves)

        return await asyncio.to_thread(_run)

    async def play(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        skill_level: int,
    ) -> PlayedMove:
        """Choose a move on fen, capped at the given skill level."""

        def _run() -> PlayedMove:
            board = chess.Board(fen)
            self._engine.configure({"Skill Level": skill_level})
            try:
                result = self._engine.play(
                    board,
                    chess.engine.Limit(depth=depth, time=max_time_ms / 1000.0),
                    info=chess.engine.INFO_SCORE,
                )
            finally:
                # Restore full strength so later analysis requests
                # are never weakened by a lowered skill level.
                self._engine.configure({"Skill Level": 20})
            if result.move is None:
                raise RuntimeError("engine returned no move")
            score_cp: int | None = None
            mate_in: int | None = None
            score = result.info.get("score")
            if isinstance(score, chess.engine.PovScore):
                score_cp, mate_in = _score_fields(score)
            return PlayedMove(move=result.move, score_cp=score_cp, mate_in=mate_in)

        return await asyncio.to_thread(_run)

    async def close(self) -> None:
        """Terminate the Stockfish process."""
        await asyncio.to_thread(self._engine.quit)


class EnginePool:
    """A fixed set of engine processes shared through an asyncio queue.

    Stockfish processes are not safe for concurrent commands, so the
    pool hands out one engine per in-flight request.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._engines: asyncio.Queue[StockfishEngine] = asyncio.Queue()

    async def start(self) -> None:
        """Spawn the engine processes."""
        for _ in range(self._settings.stockfish_pool_size):
            self._engines.put_nowait(StockfishEngine(self._settings.stockfish_path))

    @asynccontextmanager
    async def acquire(self) -> AsyncGenerator[StockfishEngine]:
        """Borrow an engine for the duration of the context."""
        engine = await self._engines.get()
        try:
            yield engine
        finally:
            self._engines.put_nowait(engine)

    async def analyse(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        multi_pv: int,
    ) -> EngineAnalysis:
        """Analyse fen using any available engine from the pool."""
        async with self.acquire() as engine:
            return await engine.analyse(
                fen, depth=depth, max_time_ms=max_time_ms, multi_pv=multi_pv
            )

    async def play(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        skill_level: int,
    ) -> PlayedMove:
        """Choose a move using any available engine from the pool."""
        async with self.acquire() as engine:
            return await engine.play(
                fen,
                depth=depth,
                max_time_ms=max_time_ms,
                skill_level=skill_level,
            )

    async def close(self) -> None:
        """Terminate every engine process in the pool."""
        while not self._engines.empty():
            await self._engines.get_nowait().close()
