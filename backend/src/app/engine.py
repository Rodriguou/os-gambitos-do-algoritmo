"""Chess engine abstraction: a Stockfish adapter and a process pool.

The rest of the app talks to the ChessEngine protocol instead of to
python-chess directly, so the engine stays swappable and the service
remains unit-testable with a fake implementation.
"""

from __future__ import annotations

import asyncio
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


def _win_rate(info: chess.engine.InfoDict, board: chess.Board) -> float | None:
    """Best-effort win probability for the side to move, from WDL data."""
    wdl = info.get("wdl")
    if wdl is None:
        return None
    pov = wdl.pov(board.turn)
    total = pov.wins + pov.draws + pov.losses
    if total == 0:
        return None
    return (pov.wins + 0.5 * pov.draws) / total


def _score_fields(score: chess.engine.PovScore) -> tuple[int | None, int | None]:
    """Split a PovScore into (score_cp, mate_in)."""
    relative = score.relative
    if isinstance(relative, chess.engine.Mate):
        return None, relative.moves
    return relative.score(), None


def _scored_move(move: chess.Move, info: chess.engine.InfoDict, board: chess.Board) -> ScoredMove:
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
        win_rate=_win_rate(info, board),
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
            self._engine.configure({"UCI_ShowWDL": True})
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
                    moves.append(_scored_move(pv[0], info, board))
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
