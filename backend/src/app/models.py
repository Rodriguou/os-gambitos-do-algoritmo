"""Request and response models (DTOs) for the analysis API."""

from typing import Literal

from pydantic import BaseModel, Field

from app.config import ExplainerMode

MoveClassification = Literal["blunder", "mistake", "inaccuracy", "good", "excellent", "brilliancy"]

DifficultyLevel = Literal["beginner", "intermediate", "advanced"]


class AnalysisOptions(BaseModel):
    """Tunable options for a single analysis request."""

    depth: int | None = Field(default=None, ge=1, le=50)
    max_time_ms: int | None = Field(default=None, ge=10, le=30_000)
    multi_pv: int | None = Field(default=None, ge=1, le=10)
    explanation_mode: ExplainerMode | None = None


class AnalysisRequest(BaseModel):
    """A played move to evaluate: the position (FEN) and the move (UCI or SAN)."""

    fen: str
    move: str
    options: AnalysisOptions = Field(default_factory=AnalysisOptions)


class MoveEvaluation(BaseModel):
    """Evaluation of a single move."""

    move: str
    san: str
    score_cp: int | None = None
    mate_in: int | None = None
    win_rate: float | None = None
    classification: MoveClassification | None = None
    depth: int


class PositionInfo(BaseModel):
    """State of the position from the perspective of the side to move."""

    turn: Literal["w", "b"]
    check: bool
    checkmate: bool
    stalemate: bool
    legal_moves: int
    material_balance_cp: int


class Explanation(BaseModel):
    """Didactic feedback about the played move, written in pt-BR."""

    mode: ExplainerMode
    classification: MoveClassification
    summary: str
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    """Full analysis of a played move."""

    fen: str
    move: MoveEvaluation
    position: PositionInfo
    alternatives: list[MoveEvaluation]
    explanation: Explanation


class ErrorResponse(BaseModel):
    """Standard error payload."""

    error: str
    detail: str | None = None


class BestMoveRequest(BaseModel):
    """Position (FEN) for which the opponent should move."""

    fen: str
    level: DifficultyLevel = "intermediate"


class BestMoveResponse(BaseModel):
    """The opponent's move with its evaluation."""

    move: str
    san: str
    score_cp: int | None = None
    mate_in: int | None = None
    level: DifficultyLevel


class PositionEvalRequest(BaseModel):
    """A position (FEN) to evaluate for the advantage bar."""

    fen: str
    depth: int | None = Field(default=None, ge=1, le=50)


class PositionEvalResponse(BaseModel):
    """Evaluation of the current position, always from White's perspective."""

    fen: str
    turn: Literal["w", "b"]
    score_cp: int | None = None
    mate_in: int | None = None
    win_rate: float | None = None
    depth: int


class ConfigResponse(BaseModel):
    """Runtime capabilities the frontend needs to configure itself."""

    llm_available: bool
    explainer_default_mode: ExplainerMode
