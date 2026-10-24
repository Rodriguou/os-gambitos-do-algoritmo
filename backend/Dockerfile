# ==============================================================================
# Estágio 1: Builder (instalação de dependências de produção via uv)
# ==============================================================================
FROM ghcr.io/astral-sh/uv:latest AS uv_bin
FROM python:3.13-slim-bookworm AS builder

# Importa o binário do uv
COPY --from=uv_bin /uv /bin/uv

# Otimizações de compilação
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Cache de dependências: copia definições antes do código
COPY pyproject.toml uv.lock ./

# Instala dependências de produção sem instalar o código do projeto ainda
RUN uv sync --frozen --no-dev --no-install-project

# Copia o código-fonte e instala o projeto
COPY src/ ./src/
COPY README.md ./
RUN uv sync --frozen --no-dev

# ==============================================================================
# Estágio 2: Runtime de Produção (enxuta, segura e sem root)
# ==============================================================================
FROM python:3.13-slim-bookworm AS runtime

# Instala o Stockfish Linux e remove caches do apt para manter a imagem leve
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish && \
    rm -rf /var/lib/apt/lists/* && \
    if [ -f /usr/games/stockfish ] && [ ! -f /usr/local/bin/stockfish ]; then \
        ln -s /usr/games/stockfish /usr/local/bin/stockfish; \
    fi

# Criação de usuário sem privilégios (non-root)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /sbin/nologin -M appuser

WORKDIR /app

# Copia apenas o virtualenv e o código do builder com permissões do appuser
COPY --from=builder --chown=appuser:appgroup /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appgroup /app/src /app/src

# Configurações de ambiente para execução
ENV PATH="/app/.venv/bin:/usr/games:/usr/local/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    STOCKFISH_PATH="stockfish" \
    PORT=8000

# Execução segura sem root
USER appuser

EXPOSE 8000

# Health check usando a biblioteca padrão do Python (sem necessidade de curl)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:' + str(__import__('os').environ.get('PORT', 8000)) + '/v1/health', timeout=3)" || exit 1

# Inicializa o Uvicorn com exec para que receba os sinais de término (SIGTERM)
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
