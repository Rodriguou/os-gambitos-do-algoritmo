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

| Método | Caminho         | Descrição                                              |
| ------ | --------------- | ------------------------------------------------------ |
| POST   | `/v1/analysis`  | Avalia uma jogada (FEN + lance UCI/SAN)                |
| POST   | `/v1/best-move` | Lance do adversário (FEN + nível de dificuldade)       |
| POST   | `/v1/evaluate`  | Avalia a posição atual para a barra de vantagem        |
| GET    | `/v1/config`    | Diz se a Azure está disponível e o modo padrão         |
| GET    | `/v1/health`    | Verifica se o Stockfish está respondendo               |

Níveis de dificuldade do adversário (`level`, default `intermediate`):
`beginner` (Skill Level 0, depth 2), `intermediate` (Skill Level 8,
depth 12), `advanced` (Skill Level 20, depth 18). O `score_cp` da
resposta é a avaliação após o lance da IA, na perspectiva da própria IA.

`/v1/evaluate` devolve a avaliação **sempre na perspectiva das brancas**
(`turn` indica de quem é a vez). A busca usa `POSITION_EVAL_DEPTH`
(default 12) e é separada da análise didática, que roda em profundidade
cheia. Posições de xeque-mate usam um score sentinela (`±100000`) para a
barra ir direto ao extremo; empates devolvem `0`.

`/v1/config` devolve `{"llm_available": ..., "explainer_default_mode": ...}`.
O frontend usa isso para desabilitar o switch da Azure quando as
credenciais não estão configuradas.

## Testando a Azure

1. Preencha `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY` e
   `AZURE_OPENAI_DEPLOYMENT` no `.env` e reinicie a API.
2. Confirme que ela foi detectada:

   ```bash
   curl http://127.0.0.1:8000/v1/config
   # {"llm_available":true,"explainer_default_mode":"rule"}
   ```

3. Na interface, abra **Configurações** e ligue **Tradução da Azure**.
   O mesmo lance passa a ser reexplicado pelo modelo; desligue para
   comparar com a explicação determinística.
4. Pela API, o modo é escolhido por requisição:

   ```bash
   curl -X POST http://127.0.0.1:8000/v1/analysis \
     -H "Content-Type: application/json" \
     -d '{"fen":"rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2",
          "move":"g2g4",
          "options":{"explanation_mode":"llm"}}'
   ```

   Troque `"llm"` por `"rule"` para ver a versão de regras. Se a Azure
   falhar (timeout, cota, JSON inválido), a resposta volta em `"rule"`
   automaticamente e o frontend avisa.

Veja `AGENTS.md` para as decisões de arquitetura e convenções do projeto.
