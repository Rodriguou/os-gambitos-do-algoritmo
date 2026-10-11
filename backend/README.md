# Os Gambitos do Algoritmo — Backend

API em FastAPI que analisa jogadas de xadrez em tempo real e traduz a
avaliação do Stockfish em feedback didático (IA Explicável).

## Requisitos

- Python 3.13 ([uv](https://docs.astral.sh/uv/) como gerenciador de dependências)
- Binário do [Stockfish](https://stockfishchess.org/) instalado e acessível
  (ou aponte `STOCKFISH_PATH` para o executável)

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

| Método | Caminho     | Descrição                                        |
| ------ | ----------- | ------------------------------------------------ |
| POST   | `/v1/analysis` | Avalia uma jogada (FEN + lance UCI/SAN)        |
| GET    | `/v1/health`   | Verifica se o Stockfish está respondendo         |

Veja `AGENTS.md` para as decisões de arquitetura e convenções do projeto.
