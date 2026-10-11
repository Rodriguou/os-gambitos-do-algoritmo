# os-gambitos-do-algoritmo

Sistema de análise de jogadas de xadrez em tempo real com Inteligência
Artificial Explicável (XAI): avalia lances com o Stockfish e traduz a
avaliação em feedback didático (prós e contras) em português.

## Pastas

- `backend/` — API FastAPI + Stockfish + camada XAI (Python, uv).
  Veja `backend/README.md` para executar e `backend/AGENTS.md` para
  as decisões de arquitetura.
- `frontend/` — a definir (React + react-chessboard + chess.js).

## Stack

| Parte     | Tecnologia                                        |
| --------- | ------------------------------------------------- |
| Backend   | Python 3.13, FastAPI, python-chess, Stockfish     |
| XAI       | Camada de regras determinística + Azure OpenAI (opt-in) |
| Frontend  | React, react-chessboard, chess.js                 |
