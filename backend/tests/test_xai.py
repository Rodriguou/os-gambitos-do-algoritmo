"""Unit tests for the XAI layer: classification, features, explainers."""

import chess
import pytest

from app.config import Settings
from app.engine import ScoredMove
from app.models import Explanation
from app.xai import (
    ExplanationContext,
    FeatureDelta,
    LLMExplainer,
    MoveSnapshot,
    RuleExplainer,
    classify_delta,
    extract_features,
    material_balance,
    score_value,
)


def test_classify_delta_thresholds() -> None:
    assert classify_delta(200) == "brilliancy"
    assert classify_delta(150) == "brilliancy"
    assert classify_delta(80) == "excellent"
    assert classify_delta(50) == "excellent"
    assert classify_delta(10) == "good"
    assert classify_delta(-10) == "good"
    assert classify_delta(-60) == "inaccuracy"
    assert classify_delta(-150) == "inaccuracy"
    assert classify_delta(-200) == "mistake"
    assert classify_delta(-300) == "mistake"
    assert classify_delta(-301) == "blunder"


def test_score_value_converts_mates() -> None:
    move = chess.Move.from_uci("a2a3")
    assert score_value(ScoredMove(move=move, mate_in=2, pv=[])) == 100_000 - 2
    assert score_value(ScoredMove(move=move, mate_in=0, pv=[])) == -100_000
    assert score_value(ScoredMove(move=move, mate_in=-1, pv=[])) == -(100_000 - 1)
    assert score_value(ScoredMove(move=move, score_cp=150, pv=[])) == 150


def test_material_balance_after_capture() -> None:
    board = chess.Board("6k1/4r3/8/8/8/8/4R3/K7 w - - 0 1")
    assert material_balance(board, chess.WHITE) == 0
    board.push_san("Rxe7")
    assert material_balance(board, chess.WHITE) == 5


def test_extract_features_center_control() -> None:
    board = chess.Board("4r2k/8/8/8/8/8/8/KN6 w - - 0 1")
    features = {f.name: f for f in extract_features(board, board.parse_san("Nc3"))}
    assert features["center_control"].delta == 2


def test_extract_features_material_and_pawn_structure() -> None:
    board = chess.Board("6k1/4r3/8/8/8/8/4R3/K7 w - - 0 1")
    features = {f.name: f for f in extract_features(board, board.parse_san("Rxe7"))}
    assert features["material_balance"].delta == 5

    board = chess.Board("4r2k/8/8/8/8/4p3/3P1P2/K7 w - - 0 1")
    features = {f.name: f for f in extract_features(board, board.parse_san("dxe3"))}
    assert features["pawn_structure"].delta == 2


async def test_rule_explainer_builds_feedback() -> None:
    context = ExplanationContext(
        fen=chess.STARTING_FEN,
        move_san="e4",
        classification="excellent",
        score_cp=50,
        mate_in=None,
        win_rate=0.52,
        alternatives=[MoveSnapshot(san="d4", score_cp=30, mate_in=None)],
        features=[FeatureDelta(name="center_control", delta=2.0, unit="squares")],
    )
    explanation = await RuleExplainer().explain(context)
    assert explanation.mode == "rule"
    assert explanation.classification == "excellent"
    assert any("centro" in pro for pro in explanation.pros)
    assert "Melhor alternativa: d4" in explanation.summary


async def test_llm_explainer_falls_back_on_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        azure_openai_endpoint="https://example.com",
        azure_openai_key="fake",
        azure_openai_deployment="fake-deployment",
    )
    explainer = LLMExplainer(settings, fallback=RuleExplainer())

    def _boom(context: ExplanationContext) -> Explanation:
        raise RuntimeError("network down")

    monkeypatch.setattr(explainer, "_generate", _boom)
    explanation = await explainer.explain(_make_context())
    assert explanation.mode == "rule"


async def test_llm_explainer_caches_by_position_and_move(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        azure_openai_endpoint="https://example.com",
        azure_openai_key="fake",
        azure_openai_deployment="fake-deployment",
    )
    explainer = LLMExplainer(settings, fallback=RuleExplainer())
    calls: list[str] = []

    def _fake(context: ExplanationContext) -> Explanation:
        calls.append(context.move_san)
        return Explanation(mode="llm", classification=context.classification, summary="cached")

    monkeypatch.setattr(explainer, "_generate", _fake)
    first = await explainer.explain(_make_context())
    second = await explainer.explain(_make_context())
    assert len(calls) == 1
    assert first.summary == second.summary == "cached"


def _make_context() -> ExplanationContext:
    return ExplanationContext(
        fen=chess.STARTING_FEN,
        move_san="e4",
        classification="good",
        score_cp=0,
        mate_in=None,
        win_rate=0.5,
        alternatives=[MoveSnapshot(san="d4", score_cp=-20, mate_in=None)],
        features=[],
    )
