# AGENTS.md — Backend

This file documents the structural decisions of the backend so that
any agent (or human) can work on the codebase without re-deriving
the architecture. Read it before making changes.

## What this is

FastAPI backend for "Os Gambitos do Algoritmo": it receives a chess
position (FEN) and a played move, evaluates them with Stockfish, and
translates the evaluation into didactic feedback in pt-BR (the XAI
layer). The frontend (React + react-chessboard + chess.js) owns the
game state; this API is stateless.

## Commands

```bash
uv sync                      # install dependencies
uv run uvicorn app.main:app --app-dir src --reload   # dev server
uv run pytest                # tests (no Stockfish needed)
uv run ruff check            # lint
uv run ruff format --check   # formatting check
uv run pyright               # strict type checking
```

## Project structure

```
src/app/
  main.py       # app factory, lifespan (engine pool wiring), CORS, error handler
  config.py     # pydantic-settings: everything comes from env vars
  models.py     # Pydantic DTOs (request/response)
  router.py     # HTTP endpoints: POST /v1/analysis, POST /v1/best-move, GET /v1/health
  engine.py     # ChessEngine protocol, Stockfish adapter, process pool
  xai.py        # XAI layer: classifier, feature extractor, rule + LLM explainers
  analysis.py   # AnalysisService: orchestration and request validation
tests/
  fake_engine.py  # deterministic ChessEngine double
```

## Architecture decisions

**Stateless API.** Each request carries the FEN and the move. No
session, no database. Scales horizontally and keeps the backend dumb;
the frontend already tracks the game with chess.js.

**Protocols over concrete classes.** `ChessEngine` and
`ExplanationProvider` are `Protocol`s. The rest of the app never
imports python-chess or the OpenAI SDK directly from business logic,
so engines and explainers are swappable and unit-testable with fakes
(`tests/fake_engine.py`). This is the Adapter + Strategy pattern,
nothing more.

**Engine pool + threads.** Stockfish's API is synchronous, so every
call runs in `asyncio.to_thread` to keep the event loop free.
Stockfish processes are not safe for concurrent commands, so a fixed
pool (`STOCKFISH_POOL_SIZE`, default 4) hands out one engine per
in-flight request via an asyncio queue. The pool starts in the FastAPI
lifespan and is closed on shutdown.

**Multi-PV with fallback.** The engine is asked for the top N moves
(Multi-PV). If the played move is not in that window (common for
blunders), the service plays the move on a board copy, analyses the
resulting position, and flips the opponent's evaluation back to the
player's perspective. This guarantees the played move always has a
score comparable to the best move. Lines are sorted by score before
being returned, so `moves[0]` is always the best one; the depth is the
real search bound and `DEFAULT_MAX_TIME_MS` is only a safety watchdog
(a tight time cap would cut lines at different depths and make the
Multi-PV window inconsistent).

**XAI layer (the core of the project).** Three deterministic pieces:

1. `classify_move` — loss of win probability between the played move
   and the best move, obtained by converting the centipawn score through
   the same logistic curve used by the frontend advantage bar (Stockfish
   WDL is returned for display, but swings too much across Multi-PV lines
   to drive the class), mapped to a class:
   `<= 2 p.p. excellent`, `<= 5 good`, `<= 10 inaccuracy`,
   `<= 20 mistake`, else `blunder`. Delivering mate is a `brilliancy`.
   The loss is clamped at zero, so inconsistent Multi-PV lines can
   never fake a brilliancy.
2. `extract_features` — pre/post-move deltas of interpretable
   features computed with python-chess: material balance, mobility
   (attacked squares), king safety (attackers on the king square),
   center control, pawn structure (doubled + isolated pawns).
3. `RuleExplainer` — maps features and classification to pt-BR
   prós/contras and a summary. Free, instant, fully testable.

**LLM guardrails.** `LLMExplainer` (Azure OpenAI) is an *opt-in*
polisher, selected per request via `explanation_mode` (default from
`EXPLAINER_DEFAULT_MODE`, default `rule`). Rules:

- It **never computes evaluations**. It receives Stockfish numbers and
  only rewrites them into natural language, so it cannot hallucinate
  scores.
- It is enabled only when `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`
  and `AZURE_OPENAI_DEPLOYMENT` are all set.
- Any failure (network, quota, JSON parsing) falls back to
  `RuleExplainer` — the API never breaks because of the LLM.
- Responses are cached by (FEN, move, classification, score, mate)
  with an LRU cap (`CACHE_MAX_SIZE`) to save credits; positions repeat
  a lot in chess.
- Uses a small model, low temperature, and JSON response format.

**Opponent endpoint.** `POST /v1/best-move` returns the engine's move
for the side to move at a didactic difficulty level (`beginner` /
`intermediate` / `advanced`, mapped to Skill Level + depth in
`LEVEL_SETTINGS`). Feedback (`/v1/analysis`) always runs at full
strength — only the opponent is weakened. Because the pool shares
processes across requests, `StockfishEngine.play` resets
`Skill Level` to 20 in a `finally` block, so a weakened opponent can
never leak into a later analysis. Positions with no legal moves return
400 (`GameOverError`). The response `score_cp` is the evaluation after
the AI's move, from the AI's own perspective.

**Server-side validation.** The frontend validates with chess.js, but
the backend re-validates everything: FEN parsing + `board.is_valid()`,
and move legality (UCI first, then SAN). Invalid input returns 400
with `{"error": "invalid_request", "detail": ...}`.

**Config via env.** All tunables live in `config.py` (pydantic-settings,
reads `.env`). No hard-coded secrets or paths. See `.env.example`.

## Conventions

- Code and docstrings in **English**; user-facing generated text in
  **pt-BR**.
- Full type annotations; `pyright` in **strict** mode must stay clean.
- Ruff for lint/format; the selected rule sets are in `pyproject.toml`
  (`B008` is ignored in `router.py` because `Depends()` defaults are
  the FastAPI idiom).
- No over-engineering: no DB, no cache server, no WebSocket, no auth.
  If a module grows past ~300 lines, split it; until then, keep the
  flat layout.

## Testing strategy

`pytest` + `pytest-asyncio` (auto mode). The service is tested against
`FakeEngine`, which ranks legal moves in python-chess generation order
with falling scores — this makes the Multi-PV window deterministic and
exercises both the in-window and fallback paths without Stockfish.
Integration tests with the real engine are skipped by design (the
binary is an external dependency); `GET /v1/health` covers that at
runtime.

## Extending

- **New engine**: implement `ChessEngine` (analyse + play + close).
- **New explainer mode**: implement `ExplanationProvider.explain`,
  add a mode to `ExplainerMode`, wire it in `AnalysisService.analyze`.
- **New feature for prós/contras**: add a `FeatureSpec` to `FEATURES`
  in `xai.py` (name, unit, polarity, compute function).
- **New threshold**: adjust the constants at the top of `xai.py`.
