"""Engine adapter tests that do not need a Stockfish binary."""

import chess
import chess.engine
import pytest

from app.engine import _scored_move  # pyright: ignore[reportPrivateUsage]


def test_scored_move_ignores_saturated_stockfish_wdl() -> None:
    # Stockfish 19 reports a saturated WDL (1000/0/0) for +1.98, which
    # contradicts the advantage bar (~67%). The cp curve must win.
    info: chess.engine.InfoDict = {
        "score": chess.engine.PovScore(chess.engine.Cp(198), chess.WHITE),
        "wdl": chess.engine.PovWdl(chess.engine.Wdl(1000, 0, 0), chess.WHITE),
        "depth": 12,
        "pv": [chess.Move.from_uci("e2e4")],
    }
    scored = _scored_move(chess.Move.from_uci("e2e4"), info)
    assert scored.win_rate == pytest.approx(0.67, abs=0.01)


def test_scored_move_forced_mate_reaches_the_extremes() -> None:
    info: chess.engine.InfoDict = {
        "score": chess.engine.PovScore(chess.engine.Mate(2), chess.WHITE),
        "pv": [chess.Move.from_uci("a1a8")],
    }
    assert _scored_move(chess.Move.from_uci("a1a8"), info).win_rate == 1.0
    losing: chess.engine.InfoDict = {
        "score": chess.engine.PovScore(chess.engine.Mate(-2), chess.WHITE),
        "pv": [chess.Move.from_uci("a1a8")],
    }
    assert _scored_move(chess.Move.from_uci("a1a8"), losing).win_rate == 0.0
