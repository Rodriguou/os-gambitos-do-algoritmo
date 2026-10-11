"""Service tests for the analysis orchestration, using the fake engine."""

import chess
import pytest

from app.analysis import AnalysisService, IllegalMoveError, InvalidFenError
from app.config import Settings
from app.models import AnalysisOptions, AnalysisRequest
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
    assert response.move.classification == "good"
    assert all(alternative.move != "g1h3" for alternative in response.alternatives)


async def test_mate_in_one_is_classified_as_brilliancy() -> None:
    service = make_service(FakeEngine())
    response = await service.analyze(
        AnalysisRequest(fen="6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", move="a1a8")
    )
    assert response.move.mate_in == 1
    assert response.move.classification == "brilliancy"
    assert "Xeque-mate em 1" in response.explanation.summary


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
