"""Orchestration of a move analysis request."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import chess

from app.config import Settings
from app.engine import (
    MATE_SCORE,
    ChessEngine,
    EngineAnalysis,
    ScoredMove,
    score_value,
    win_rate_from_eval,
)
from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    BestMoveRequest,
    BestMoveResponse,
    ConfigResponse,
    DifficultyLevel,
    MoveClassification,
    MoveEvaluation,
    PositionEvalRequest,
    PositionEvalResponse,
    PositionInfo,
)
from app.xai import (
    ExplanationContext,
    ExplanationProvider,
    LLMExplainer,
    MoveSnapshot,
    RuleExplainer,
    classify_move,
    extract_features,
    material_balance,
    win_rate_loss,
)


class AnalysisError(Exception):
    """Base class for user-facing analysis errors."""


class InvalidFenError(AnalysisError):
    """The FEN could not be parsed or describes an illegal position."""


class IllegalMoveError(AnalysisError):
    """The move is not legal in the given position."""


class GameOverError(AnalysisError):
    """The position has no legal moves (checkmate or stalemate)."""


@dataclass(frozen=True)
class LevelSettings:
    """Engine parameters behind a difficulty level."""

    skill_level: int
    depth: int


LEVEL_SETTINGS: dict[DifficultyLevel, LevelSettings] = {
    "beginner": LevelSettings(skill_level=0, depth=2),
    "intermediate": LevelSettings(skill_level=8, depth=12),
    "advanced": LevelSettings(skill_level=20, depth=18),
}


class AnalysisService:
    """Coordinates engine evaluation and didactic explanation."""

    def __init__(
        self,
        engine: ChessEngine,
        rule_explainer: RuleExplainer,
        llm_explainer: LLMExplainer | None,
        settings: Settings,
    ) -> None:
        self._engine = engine
        self._rule_explainer = rule_explainer
        self._llm_explainer = llm_explainer
        self._settings = settings

    async def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        """Validate a request and analyse the played move end to end."""
        board = self._board(request.fen)
        move = self._move(board, request.move)

        options = request.options
        depth = options.depth or self._settings.default_depth
        max_time_ms = options.max_time_ms or self._settings.default_max_time_ms
        multi_pv = min(
            options.multi_pv or self._settings.default_multi_pv,
            board.legal_moves.count(),
        )
        mode = options.explanation_mode or self._settings.explainer_default_mode

        analysis = await self._engine.analyse(
            request.fen, depth=depth, max_time_ms=max_time_ms, multi_pv=multi_pv
        )
        if not analysis.moves:
            raise RuntimeError("engine returned no analysis for the position")

        played = self._find(analysis, move)
        if played is None:
            played = await self._evaluate_played_move(board, move, depth, max_time_ms)

        best = max(analysis.moves, key=score_value)
        classification = classify_move(played, best)

        context = ExplanationContext(
            fen=request.fen,
            move_san=board.san(move),
            classification=classification,
            score_cp=played.score_cp,
            mate_in=played.mate_in,
            win_rate=played.win_rate,
            win_rate_loss=win_rate_loss(played, best),
            alternatives=[
                MoveSnapshot(
                    san=board.san(scored.move),
                    score_cp=scored.score_cp,
                    mate_in=scored.mate_in,
                )
                for scored in analysis.moves
                if scored.move != move
            ][:3],
            features=extract_features(board, move),
        )

        explainer: ExplanationProvider = (
            self._llm_explainer
            if mode == "llm" and self._llm_explainer is not None
            else self._rule_explainer
        )
        explanation = await explainer.explain(context)

        return AnalysisResponse(
            fen=request.fen,
            move=self._to_evaluation(move, board, played, classification, depth),
            position=self._position_info(board),
            alternatives=[
                self._to_evaluation(scored.move, board, scored, None, depth)
                for scored in analysis.moves
                if scored.move != move
            ],
            explanation=explanation,
        )

    async def ping(self) -> bool:
        """Check whether the engine responds to a trivial analysis."""
        try:
            await self._engine.analyse(chess.STARTING_FEN, depth=1, max_time_ms=50, multi_pv=1)
        except Exception:
            return False
        return True

    async def best_move(self, request: BestMoveRequest) -> BestMoveResponse:
        """Choose the opponent's move at the requested difficulty."""
        board = self._board(request.fen)
        if board.legal_moves.count() == 0:
            raise GameOverError("the game is over: no legal moves")
        level = LEVEL_SETTINGS[request.level]
        played = await self._engine.play(
            request.fen,
            depth=level.depth,
            max_time_ms=self._settings.default_max_time_ms,
            skill_level=level.skill_level,
        )
        return BestMoveResponse(
            move=played.move.uci(),
            san=board.san(played.move),
            score_cp=played.score_cp,
            mate_in=played.mate_in,
            level=request.level,
        )

    async def evaluate_position(self, request: PositionEvalRequest) -> PositionEvalResponse:
        """Evaluate the current position for the advantage bar.

        Stockfish returns scores from the side to move; the bar always
        speaks from White's perspective, so Black-to-move lines are flipped.
        """
        board = self._board(request.fen)
        depth = request.depth or self._settings.position_eval_depth
        turn: Literal["w", "b"] = "w" if board.turn else "b"

        if board.is_checkmate():
            white_won = board.turn == chess.BLACK
            return PositionEvalResponse(
                fen=request.fen,
                turn=turn,
                score_cp=MATE_SCORE if white_won else -MATE_SCORE,
                win_rate=1.0 if white_won else 0.0,
                depth=depth,
            )
        if board.is_game_over():
            return PositionEvalResponse(
                fen=request.fen, turn=turn, score_cp=0, win_rate=0.5, depth=depth
            )

        analysis = await self._engine.analyse(
            request.fen,
            depth=depth,
            max_time_ms=self._settings.default_max_time_ms,
            multi_pv=1,
        )
        if not analysis.moves:
            raise RuntimeError("engine returned no analysis for the position")

        scored = analysis.moves[0]
        score_cp = scored.score_cp
        mate_in = scored.mate_in
        if board.turn == chess.BLACK:
            score_cp = None if score_cp is None else -score_cp
            mate_in = None if mate_in is None else -mate_in
        # Derived from the White-perspective eval, with the same curve as the
        # frontend bar, so both always agree.
        win_rate = win_rate_from_eval(score_cp, mate_in)

        return PositionEvalResponse(
            fen=request.fen,
            turn=turn,
            score_cp=score_cp,
            mate_in=mate_in,
            win_rate=win_rate,
            depth=depth,
        )

    def config(self) -> ConfigResponse:
        """Report which optional features are available at runtime."""
        return ConfigResponse(
            llm_available=self._llm_explainer is not None,
            explainer_default_mode=self._settings.explainer_default_mode,
        )

    def _board(self, fen: str) -> chess.Board:
        """Parse and validate a FEN."""
        try:
            board = chess.Board(fen)
        except ValueError as error:
            raise InvalidFenError(str(error)) from error
        if not board.is_valid():
            raise InvalidFenError(f"illegal position: {board.status()!r}")
        return board

    def _move(self, board: chess.Board, notation: str) -> chess.Move:
        """Parse a move in UCI or SAN notation and check that it is legal."""
        try:
            move = chess.Move.from_uci(notation)
        except ValueError:
            move = None
        if move is not None and move in board.legal_moves:
            return move
        try:
            return board.parse_san(notation)
        except ValueError as error:
            raise IllegalMoveError(f"illegal move: {notation!r}") from error

    async def _evaluate_played_move(
        self, board: chess.Board, move: chess.Move, depth: int, max_time_ms: int
    ) -> ScoredMove:
        """Evaluate a move that fell outside the Multi-PV window.

        The move is played on a copy of the board and the resulting
        position is analysed; the opponent's evaluation is then
        flipped back to the player's perspective.
        """
        after = board.copy(stack=False)
        after.push(move)
        if after.is_checkmate():
            return ScoredMove(
                move=move, score_cp=None, mate_in=1, win_rate=1.0, depth=depth, pv=[move]
            )
        analysis = await self._engine.analyse(
            after.fen(), depth=depth, max_time_ms=max_time_ms, multi_pv=1
        )
        if not analysis.moves:
            return ScoredMove(
                move=move, score_cp=0, mate_in=None, win_rate=0.5, depth=depth, pv=[move]
            )
        opponent = analysis.moves[0]
        mate_in = None
        if opponent.mate_in is not None:
            mate_in = -opponent.mate_in if opponent.mate_in != 0 else 1
        score_cp = None if opponent.score_cp is None else -opponent.score_cp
        return ScoredMove(
            move=move,
            score_cp=score_cp,
            mate_in=mate_in,
            win_rate=win_rate_from_eval(score_cp, mate_in),
            depth=depth,
            pv=[move],
        )

    @staticmethod
    def _find(analysis: EngineAnalysis, move: chess.Move) -> ScoredMove | None:
        """Return the analysis entry for a move, if the engine ranked it."""
        for scored in analysis.moves:
            if scored.move == move:
                return scored
        return None

    @staticmethod
    def _position_info(board: chess.Board) -> PositionInfo:
        """Summarize the state of the position."""
        return PositionInfo(
            turn="w" if board.turn else "b",
            check=board.is_check(),
            checkmate=board.is_checkmate(),
            stalemate=board.is_stalemate(),
            legal_moves=board.legal_moves.count(),
            material_balance_cp=int(material_balance(board, board.turn) * 100),
        )

    @staticmethod
    def _to_evaluation(
        move: chess.Move,
        board: chess.Board,
        scored: ScoredMove,
        classification: MoveClassification | None,
        depth: int,
    ) -> MoveEvaluation:
        """Convert an engine result into the API DTO."""
        return MoveEvaluation(
            move=move.uci(),
            san=board.san(move),
            score_cp=scored.score_cp,
            mate_in=scored.mate_in,
            win_rate=scored.win_rate,
            classification=classification,
            depth=depth,
        )
