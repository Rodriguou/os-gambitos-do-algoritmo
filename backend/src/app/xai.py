"""Explainable AI layer: translates Stockfish numbers into didactic feedback.

The layer has two parts:

- Deterministic heuristics (classification thresholds and interpretable
  feature deltas) that power the default explainer: free, instant
  and fully auditable.
- An optional Azure OpenAI explainer that rewrites the same
  deterministic data into natural language. It never computes
  evaluations, so every number comes from Stockfish and the LLM
  cannot hallucinate them.
"""

from __future__ import annotations

import asyncio
import json
import math
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

import chess
from openai import AzureOpenAI

from app.config import Settings
from app.engine import ScoredMove, score_value
from app.models import Explanation, MoveClassification

# Classification is based on how much win probability the move gave away,
# not on raw centipawns: losing 100cp from a winning position is not the
# same as losing 100cp from an equal one. Each constant is the maximum
# loss in win probability (0..1) still allowed for that class.
EXCELLENT_MAX_LOSS = 0.02
GOOD_MAX_LOSS = 0.05
INACCURACY_MAX_LOSS = 0.10
MISTAKE_MAX_LOSS = 0.20

# Centipawns are converted to win probability with the same logistic
# curve used by the frontend advantage bar. Stockfish's WDL is exposed to
# the user as "chance de vitória", but it is too noisy across Multi-PV
# lines at didactic depths to drive the classification.
WIN_RATE_SLOPE = 0.00368208

PIECE_VALUES: dict[int, float] = {
    chess.PAWN: 1,
    chess.KNIGHT: 3,
    chess.BISHOP: 3,
    chess.ROOK: 5,
    chess.QUEEN: 9,
}
CENTER_SQUARES = frozenset({chess.D4, chess.E4, chess.D5, chess.E5})


def win_rate_from_score(score_cp: int) -> float:
    """Approximate win probability (0..1) from a centipawn score."""
    return 1 / (1 + math.exp(-WIN_RATE_SLOPE * score_cp))


def _win_rate(move: ScoredMove) -> float:
    """Win probability for the side that made the move."""
    return win_rate_from_score(score_value(move))


def classify_move(played: ScoredMove, best: ScoredMove) -> MoveClassification:
    """Classify a move by how much winning chance it gave away to the best move."""
    # Delivering mate ends the game: always a brilliancy, even though the
    # delta against the best move is zero.
    if played.mate_in is not None and played.mate_in > 0:
        return "brilliancy"

    # Clamped at zero: inconsistent Multi-PV lines must never turn a move
    # into a brilliancy just because it outscored the reported best move.
    loss = max(0.0, _win_rate(best) - _win_rate(played))
    if loss <= EXCELLENT_MAX_LOSS:
        return "excellent"
    if loss <= GOOD_MAX_LOSS:
        return "good"
    if loss <= INACCURACY_MAX_LOSS:
        return "inaccuracy"
    if loss <= MISTAKE_MAX_LOSS:
        return "mistake"
    return "blunder"


def _material(board: chess.Board, color: chess.Color) -> float:
    """Material of one side, in pawns."""
    return sum(
        value * len(board.pieces(piece_type, color)) for piece_type, value in PIECE_VALUES.items()
    )


def material_balance(board: chess.Board, color: chess.Color) -> float:
    """Material balance in pawns, from the given color's perspective."""
    balance = _material(board, chess.WHITE) - _material(board, chess.BLACK)
    return balance if color == chess.WHITE else -balance


def _attacked_squares(board: chess.Board, color: chess.Color) -> set[int]:
    """Union of every square attacked by the given color."""
    attacked: set[int] = set()
    for square in chess.SquareSet(board.occupied_co[color]):
        attacked.update(board.attacks(square))
    return attacked


def _mobility(board: chess.Board, color: chess.Color) -> float:
    """Number of squares attacked by the given color."""
    return float(len(_attacked_squares(board, color)))


def _king_safety(board: chess.Board, color: chess.Color) -> float:
    """Enemy attackers on the king square (higher means more exposed)."""
    king = board.king(color)
    if king is None:
        return 0.0
    return float(len(board.attackers(not color, king)))


def _center_control(board: chess.Board, color: chess.Color) -> float:
    """Number of central squares attacked by the given color."""
    return float(len(_attacked_squares(board, color) & CENTER_SQUARES))


def _pawn_weaknesses(board: chess.Board, color: chess.Color) -> float:
    """Count of doubled and isolated pawns."""
    pawns = board.pieces(chess.PAWN, color)
    files = {chess.square_file(square) for square in pawns}
    doubled = sum(
        len([square for square in pawns if chess.square_file(square) == file]) - 1 for file in files
    )
    isolated = sum(
        1 for file in files if not any(neighbour in files for neighbour in (file - 1, file + 1))
    )
    return float(doubled + isolated)


@dataclass(frozen=True)
class FeatureSpec:
    """An interpretable feature: how to compute it and which direction is good."""

    name: str
    unit: str
    polarity: float
    compute: Callable[[chess.Board, chess.Color], float]


FEATURES: tuple[FeatureSpec, ...] = (
    FeatureSpec("material_balance", "pawns", 1.0, material_balance),
    FeatureSpec("mobility", "squares", 1.0, _mobility),
    FeatureSpec("king_safety", "attackers", -1.0, _king_safety),
    FeatureSpec("center_control", "squares", 1.0, _center_control),
    FeatureSpec("pawn_structure", "weaknesses", -1.0, _pawn_weaknesses),
)


@dataclass(frozen=True)
class FeatureDelta:
    """Pre/post-move delta of a feature, sign-adjusted (positive = good)."""

    name: str
    delta: float
    unit: str


def extract_features(board: chess.Board, move: chess.Move) -> list[FeatureDelta]:
    """Compute feature deltas for a move, from the mover's perspective."""
    color = board.turn
    after = board.copy(stack=False)
    after.push(move)
    return [
        FeatureDelta(
            name=spec.name,
            delta=(spec.compute(after, color) - spec.compute(board, color)) * spec.polarity,
            unit=spec.unit,
        )
        for spec in FEATURES
    ]


@dataclass(frozen=True)
class MoveSnapshot:
    """SAN and evaluation of a move, as seen by the explainer."""

    san: str
    score_cp: int | None
    mate_in: int | None


@dataclass(frozen=True)
class ExplanationContext:
    """Everything an explainer needs to describe a played move."""

    fen: str
    move_san: str
    classification: MoveClassification
    score_cp: int | None
    mate_in: int | None
    win_rate: float | None
    alternatives: list[MoveSnapshot]
    features: list[FeatureDelta]


class ExplanationProvider(Protocol):
    """Async interface for didactic feedback generators."""

    async def explain(self, context: ExplanationContext) -> Explanation:
        """Describe the played move in natural language (pt-BR)."""
        ...


CLASSIFICATION_PHRASES: dict[str, str] = {
    "brilliancy": "Jogada brilhante!",
    "excellent": "Jogada excelente.",
    "good": "Jogada sólida.",
    "inaccuracy": "Imprecisão leve.",
    "mistake": "Erro tático.",
    "blunder": "Jogada muito ruim.",
}

FEATURE_PHRASES: dict[str, tuple[str, str]] = {
    "material_balance": ("ganha material", "perde material"),
    "mobility": ("ganha mobilidade", "perde mobilidade"),
    "king_safety": ("protege o rei", "expõe o próprio rei"),
    "center_control": ("amplia o controle do centro", "cede o controle do centro"),
    "pawn_structure": (
        "melhora a estrutura de peões",
        "enfraquece a estrutura de peões",
    ),
}


class RuleExplainer:
    """Deterministic explainer: free, instant and fully testable."""

    async def explain(self, context: ExplanationContext) -> Explanation:
        """Build prós and contras from feature deltas and the classification."""
        pros: list[str] = []
        cons: list[str] = []
        for feature in context.features:
            if feature.delta > 0.05:
                phrase = FEATURE_PHRASES[feature.name][0]
                pros.append(f"{phrase.capitalize()} ({_format_delta(feature.delta, feature.unit)})")
            elif feature.delta < -0.05:
                phrase = FEATURE_PHRASES[feature.name][1]
                cons.append(f"{phrase.capitalize()} ({_format_delta(feature.delta, feature.unit)})")
        return Explanation(
            mode="rule",
            classification=context.classification,
            summary=self._summary(context),
            pros=pros[:3],
            cons=cons[:3],
        )

    def _summary(self, context: ExplanationContext) -> str:
        """Assemble the one-paragraph summary for the played move."""
        parts = [CLASSIFICATION_PHRASES[context.classification]]
        if context.mate_in is not None and context.mate_in > 0:
            parts.append(f"Xeque-mate em {context.mate_in} lance(s).")
        elif context.mate_in is not None and context.mate_in < 0:
            parts.append(f"Você leva mate em {abs(context.mate_in)} lance(s).")
        elif context.score_cp is not None:
            parts.append(f"Avaliação da jogada: {context.score_cp / 100:+.2f}.")
        if context.win_rate is not None:
            parts.append(f"Chance de vitória: {context.win_rate:.0%}.")
        if context.alternatives:
            best = context.alternatives[0]
            if best.score_cp is not None:
                parts.append(f"Melhor alternativa: {best.san} ({best.score_cp / 100:+.2f}).")
        return " ".join(parts)


def _format_delta(delta: float, unit: str) -> str:
    """Format a feature delta for display, e.g. '+2 squares'."""
    return f"{delta:+g} {unit}"


class LLMExplainer:
    """Azure OpenAI explainer that polishes the deterministic feedback.

    The LLM only rewrites Stockfish numbers into natural language; it
    never computes evaluations. Any failure (network, quota, parsing)
    falls back to the rule explainer, and repeated positions are served
    from a cache to save credits.
    """

    def __init__(self, settings: Settings, fallback: RuleExplainer) -> None:
        if not (
            settings.azure_openai_endpoint
            and settings.azure_openai_key
            and settings.azure_openai_deployment
        ):
            raise ValueError("Azure OpenAI endpoint, key and deployment are required")
        self._client = AzureOpenAI(
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_key,
            api_version=settings.azure_openai_api_version,
        )
        self._deployment = settings.azure_openai_deployment
        self._cache_max_size = settings.cache_max_size
        self._fallback = fallback
        self._cache: OrderedDict[str, Explanation] = OrderedDict()

    async def explain(self, context: ExplanationContext) -> Explanation:
        """Explain the move via Azure OpenAI, falling back to rules on error."""
        key = json.dumps(
            {
                "fen": context.fen,
                "move": context.move_san,
                "classification": context.classification,
                "score_cp": context.score_cp,
                "mate_in": context.mate_in,
            },
            sort_keys=True,
        )
        if key in self._cache:
            self._cache.move_to_end(key)
            return self._cache[key]
        try:
            explanation = await asyncio.to_thread(self._generate, context)
        except Exception:
            return await self._fallback.explain(context)
        self._cache[key] = explanation
        while len(self._cache) > self._cache_max_size:
            self._cache.popitem(last=False)
        return explanation

    def _generate(self, context: ExplanationContext) -> Explanation:
        """Call Azure OpenAI and parse the structured response."""
        response = self._client.chat.completions.create(
            model=self._deployment or "",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Você é um treinador de xadrez didático. Responda em "
                        "pt-BR, de forma clara e encorajadora, voltada a quem "
                        "está aprendendo. Use exclusivamente os dados "
                        "fornecidos; nunca invente avaliações. Responda apenas "
                        "com um JSON de chaves: summary, pros, cons."
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "classification": context.classification,
                            "move": context.move_san,
                            "evaluation_cp": context.score_cp,
                            "mate_in": context.mate_in,
                            "win_rate": context.win_rate,
                            "alternatives": [
                                {"san": alt.san, "score_cp": alt.score_cp}
                                for alt in context.alternatives[:3]
                            ],
                            "features": [
                                {
                                    "name": feature.name,
                                    "delta": round(feature.delta, 2),
                                    "unit": feature.unit,
                                }
                                for feature in context.features
                            ],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        payload = json.loads(response.choices[0].message.content or "{}")
        return Explanation(
            mode="llm",
            classification=context.classification,
            summary=str(payload.get("summary", "")).strip() or "Jogada analisada.",
            pros=[str(item) for item in payload.get("pros", [])][:3],
            cons=[str(item) for item in payload.get("cons", [])][:3],
        )
