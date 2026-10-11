"""Deterministic engine double used in unit tests."""

from __future__ import annotations

import chess

from app.engine import EngineAnalysis, ScoredMove


class FakeEngine:
    """A ChessEngine double with predictable, instant results.

    Ranks legal moves in python-chess's generation order, giving
    each move a slightly worse score so the best move is deterministic.
    """

    def __init__(self, base_score_cp: int = 0) -> None:
        self.base_score_cp = base_score_cp
        self.calls: list[dict[str, int]] = []

    async def analyse(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        multi_pv: int,
    ) -> EngineAnalysis:
        """Record the call and return the first legal moves with falling scores."""
        self.calls.append({"depth": depth, "max_time_ms": max_time_ms, "multi_pv": multi_pv})
        board = chess.Board(fen)
        moves = [
            ScoredMove(
                move=move,
                score_cp=self.base_score_cp - index * 20,
                mate_in=None,
                win_rate=0.5,
                depth=depth,
                pv=[move],
            )
            for index, move in enumerate(list(board.legal_moves)[:multi_pv])
        ]
        return EngineAnalysis(moves=moves)

    async def close(self) -> None:
        """Do nothing; the fake owns no resources."""
