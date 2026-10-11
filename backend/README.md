# Os Gambitos do Algoritmo — Backend

API em FastAPI que analisa jogadas de xadrez em tempo real e traduz a
avaliação do Stockfish em feedback didático (IA Explicável).

## Requisitos

- Python 3.13 ([uv](https://docs.astral.sh/uv/) como gerenciador de dependências)
- Binário do [Stockfish](https://stockfishchess.org/) — **não versionado**.
  Convenção local: coloque o executável em `vendor/stockfish.exe` (o
  `.env` já aponta para lá) ou ajuste `STOCKFISH_PATH`. Em uma máquina
  hospedeira, repita este passo antes de iniciar a API.

## Setup

```bash
uv sync
cp .env.example .env  # ajuste se necessário
```

## Executando

```bash
uv run uvicorn app.main:app --app-dir src --reload
```

Documentação interativa: <http://127.0.0.1:8000/docs>

## Testes e qualidade

```bash
uv run pytest
uv run ruff check
uv run ruff format --check
uv run pyright
```

## Endpoints

| Método | Caminho        | Descrição                                              |
| ------ | -------------- | ------------------------------------------------------ |
| POST   | `/v1/analysis` | Avalia uma jogada (FEN + lance UCI/SAN)                |
| POST   | `/v1/best-move`| Lance do adversário (FEN + nível de dificuldade)       |
| GET    | `/v1/health`   | Verifica se o Stockfish está respondendo               |

Níveis de dificuldade do adversário (`level`, default `intermediate`):
`beginner` (Skill Level 1, depth 6), `intermediate` (Skill Level 8,
depth 12), `advanced` (Skill Level 20, depth 18). O `score_cp` da
resposta é a avaliação após o lance da IA, na perspectiva da própria IA.

Veja `AGENTS.md` para as decisões de arquitetura e convenções do projeto.
