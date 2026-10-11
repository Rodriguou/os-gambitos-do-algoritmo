"""Deterministic engine double used in unit tests."""

from __future__ import annotations

import chess

from app.engine import EngineAnalysis, PlayedMove, ScoredMove


class FakeEngine:
    """A ChessEngine double with predictable, instant results.

    Ranks legal moves in python-chess's generation order, giving
    each move a slightly worse score so the best move is deterministic.
    """

    def __init__(
        self,
        base_score_cp: int = 0,
        mate_move: chess.Move | None = None,
    ) -> None:
        self.base_score_cp = base_score_cp
        self.mate_move = mate_move
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
        if self.mate_move is not None and self.mate_move in board.legal_moves:
            moves.insert(
                0,
                ScoredMove(
                    move=self.mate_move,
                    score_cp=None,
                    mate_in=1,
                    win_rate=1.0,
                    depth=depth,
                    pv=[self.mate_move],
                ),
            )
        return EngineAnalysis(moves=moves)

    async def play(
        self,
        fen: str,
        *,
        depth: int,
        max_time_ms: int,
        skill_level: int,
    ) -> PlayedMove:
        """Record the call and return the first legal move deterministically."""
        self.calls.append({"depth": depth, "max_time_ms": max_time_ms, "skill_level": skill_level})
        board = chess.Board(fen)
        moves = list(board.legal_moves)
        if not moves:
            raise RuntimeError("no legal moves")
        move = self.mate_move if self.mate_move in moves else moves[0]
        if move == self.mate_move:
            return PlayedMove(move=move, score_cp=None, mate_in=1)
        return PlayedMove(move=move, score_cp=self.base_score_cp, mate_in=None)

    async def close(self) -> None:
        """Do nothing; the fake owns no resources."""
