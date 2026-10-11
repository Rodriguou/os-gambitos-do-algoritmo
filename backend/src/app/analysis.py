"""Orchestration of a move analysis request."""

from __future__ import annotations

import chess

from app.config import Settings
from app.engine import ChessEngine, EngineAnalysis, ScoredMove
from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    MoveClassification,
    MoveEvaluation,
    PositionInfo,
)
from app.xai import (
    ExplanationContext,
    ExplanationProvider,
    LLMExplainer,
    MoveSnapshot,
    RuleExplainer,
    classify_delta,
    extract_features,
    material_balance,
    score_value,
)


class AnalysisError(Exception):
    """Base class for user-facing analysis errors."""


class InvalidFenError(AnalysisError):
    """The FEN could not be parsed or describes an illegal position."""


class IllegalMoveError(AnalysisError):
    """The move is not legal in the given position."""


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

        best = analysis.moves[0]
        if played.mate_in is not None and played.mate_in > 0:
            # Delivering mate ends the game: always a brilliancy,
            # even though the delta against the best move is zero.
            classification: MoveClassification = "brilliancy"
        else:
            classification = classify_delta(score_value(played) - score_value(best))

        context = ExplanationContext(
            fen=request.fen,
            move_san=board.san(move),
            classification=classification,
            score_cp=played.score_cp,
            mate_in=played.mate_in,
            win_rate=played.win_rate,
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
        return ScoredMove(
            move=move,
            score_cp=None if opponent.score_cp is None else -opponent.score_cp,
            mate_in=mate_in,
            win_rate=None if opponent.win_rate is None else 1.0 - opponent.win_rate,
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
