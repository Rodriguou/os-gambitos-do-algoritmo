"""Service tests for the analysis orchestration, using the fake engine."""

import chess
import pytest

from app.analysis import AnalysisService, GameOverError, IllegalMoveError, InvalidFenError
from app.config import Settings
from app.engine import MATE_SCORE
from app.models import AnalysisOptions, AnalysisRequest, BestMoveRequest, PositionEvalRequest
from app.xai import RuleExplainer
from tests.fake_engine import FakeEngine


def make_service(engine: FakeEngine) -> AnalysisService:
    return AnalysisService(engine, RuleExplainer(), None, Settings())


async def test_analysis_of_a_move_outside_the_multi_pv_window() -> None:
    engine = FakeEngine(base_score_cp=20)
    service = make_service(engine)
    response = await service.analyze(AnalysisRequest(fen=chess.STARTING_FEN, move="e2e4"))
    assert response.move.san == "e4"
    assert response.move.classification == "good"
    assert response.position.legal_moves == 20
    assert response.explanation.mode == "rule"
    # e2e4 is not among the first 3 generated moves, so the
    # service needed a targeted second analysis.
    assert len(engine.calls) == 2


async def test_analysis_with_san_notation() -> None:
    service = make_service(FakeEngine())
    response = await service.analyze(
        AnalysisRequest(fen=chess.STARTING_FEN, move="Nf3", options=AnalysisOptions(multi_pv=5))
    )
    assert response.move.san == "Nf3"
    assert response.move.classification is not None


async def test_analysis_of_a_move_inside_the_multi_pv_window() -> None:
    engine = FakeEngine()
    service = make_service(engine)
    response = await service.analyze(AnalysisRequest(fen=chess.STARTING_FEN, move="g1h3"))
    # g1h3 (Nh3) is the first generated move, so a single
    # analysis suffices and the played move is ranked directly.
    assert len(engine.calls) == 1
    assert response.move.classification == "excellent"
    assert all(alternative.move != "g1h3" for alternative in response.alternatives)


async def test_mate_in_one_is_classified_as_brilliancy() -> None:
    service = make_service(FakeEngine())
    response = await service.analyze(
        AnalysisRequest(fen="6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", move="a1a8")
    )
    assert response.move.mate_in == 1
    assert response.move.classification == "brilliancy"
    assert "Xeque-mate em 1" in response.explanation.summary


async def test_mate_inside_the_multi_pv_window_is_brilliancy() -> None:
    engine = FakeEngine(mate_move=chess.Move.from_uci("a1a8"))
    service = make_service(engine)
    response = await service.analyze(
        AnalysisRequest(fen="6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", move="a1a8")
    )
    # The mate is ranked by the engine itself, so a single
    # analysis suffices and the delta against the best move is zero.
    assert len(engine.calls) == 1
    assert response.move.mate_in == 1
    assert response.move.classification == "brilliancy"


async def test_illegal_move_is_rejected() -> None:
    service = make_service(FakeEngine())
    with pytest.raises(IllegalMoveError):
        await service.analyze(AnalysisRequest(fen=chess.STARTING_FEN, move="e2e5"))


async def test_invalid_fen_is_rejected() -> None:
    service = make_service(FakeEngine())
    with pytest.raises(InvalidFenError):
        await service.analyze(AnalysisRequest(fen="not-a-fen", move="e2e4"))


async def test_service_ping() -> None:
    assert await make_service(FakeEngine()).ping() is True


async def test_best_move_returns_first_legal_move() -> None:
    engine = FakeEngine()
    service = make_service(engine)
    response = await service.best_move(BestMoveRequest(fen=chess.STARTING_FEN))
    board = chess.Board(chess.STARTING_FEN)
    assert response.move == list(board.legal_moves)[0].uci()
    assert response.san == board.san(list(board.legal_moves)[0])
    assert response.level == "intermediate"
    # The play call records skill_level instead of multi_pv.
    assert engine.calls[-1]["skill_level"] == 8
    assert engine.calls[-1]["depth"] == 12


async def test_best_move_forwards_difficulty_level() -> None:
    engine = FakeEngine()
    service = make_service(engine)
    response = await service.best_move(BestMoveRequest(fen=chess.STARTING_FEN, level="beginner"))
    assert response.level == "beginner"
    assert engine.calls[-1] == {
        "depth": 2,
        "max_time_ms": 3000,
        "skill_level": 0,
    }


async def test_best_move_delivers_mate_when_available() -> None:
    engine = FakeEngine(mate_move=chess.Move.from_uci("a1a8"))
    service = make_service(engine)
    response = await service.best_move(BestMoveRequest(fen="6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1"))
    assert response.move == "a1a8"
    assert response.mate_in == 1


async def test_best_move_rejects_finished_game() -> None:
    service = make_service(FakeEngine())
    with pytest.raises(GameOverError):
        await service.best_move(BestMoveRequest(fen="7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))


async def test_best_move_rejects_invalid_fen() -> None:
    service = make_service(FakeEngine())
    with pytest.raises(InvalidFenError):
        await service.best_move(BestMoveRequest(fen="not-a-fen"))


async def test_evaluate_position_from_whites_perspective() -> None:
    engine = FakeEngine(base_score_cp=30)
    service = make_service(engine)
    response = await service.evaluate_position(PositionEvalRequest(fen=chess.STARTING_FEN))
    assert response.turn == "w"
    assert response.score_cp == 30
    assert response.mate_in is None
    assert response.win_rate is not None and response.win_rate > 0.5
    assert response.depth == 12
    assert engine.calls[-1]["multi_pv"] == 1


async def test_evaluate_position_flips_black_to_move() -> None:
    # After 1.e4 it is Black's turn; a +20 for Black is -20 for White.
    fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
    service = make_service(FakeEngine(base_score_cp=20))
    response = await service.evaluate_position(PositionEvalRequest(fen=fen))
    assert response.turn == "b"
    assert response.score_cp == -20
    assert response.win_rate is not None and response.win_rate < 0.5


async def test_evaluate_position_forwards_depth() -> None:
    engine = FakeEngine()
    service = make_service(engine)
    await service.evaluate_position(PositionEvalRequest(fen=chess.STARTING_FEN, depth=8))
    assert engine.calls[-1]["depth"] == 8


async def test_evaluate_position_handles_black_checkmate() -> None:
    service = make_service(FakeEngine())
    response = await service.evaluate_position(
        PositionEvalRequest(fen="7k/6Q1/6K1/8/8/8/8/8 b - - 0 1")
    )
    assert response.turn == "b"
    assert response.score_cp == MATE_SCORE
    assert response.win_rate == 1.0


async def test_evaluate_position_handles_white_checkmate() -> None:
    service = make_service(FakeEngine())
    response = await service.evaluate_position(
        PositionEvalRequest(fen="k7/8/8/8/8/5p2/6q1/7K w - - 0 1")
    )
    assert response.turn == "w"
    assert response.score_cp == -MATE_SCORE
    assert response.win_rate == 0.0
    assert response.score_cp is not None
    assert response.score_cp < 0


async def test_evaluate_position_handles_stalemate() -> None:
    service = make_service(FakeEngine())
    response = await service.evaluate_position(
        PositionEvalRequest(fen="7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")
    )
    assert response.score_cp == 0
    assert response.win_rate == 0.5


async def test_evaluate_position_rejects_invalid_fen() -> None:
    service = make_service(FakeEngine())
    with pytest.raises(InvalidFenError):
        await service.evaluate_position(PositionEvalRequest(fen="not-a-fen"))


def test_config_reports_rule_mode_without_azure() -> None:
    config = make_service(FakeEngine()).config()
    assert config.llm_available is False
    assert config.explainer_default_mode == "rule"
