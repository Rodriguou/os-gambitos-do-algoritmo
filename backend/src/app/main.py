"""Application factory for the Os Gambitos do Algoritmo backend."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.analysis import AnalysisError, AnalysisService
from app.config import settings
from app.engine import EnginePool
from app.models import ErrorResponse
from app.router import router
from app.xai import LLMExplainer, RuleExplainer


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    """Start the engine pool and wire the analysis service."""
    pool = EnginePool(settings)
    await pool.start()

    rule_explainer = RuleExplainer()
    llm_explainer = None
    if (
        settings.azure_openai_endpoint
        and settings.azure_openai_key
        and settings.azure_openai_deployment
    ):
        llm_explainer = LLMExplainer(settings, fallback=rule_explainer)

    app.state.analysis_service = AnalysisService(pool, rule_explainer, llm_explainer, settings)
    yield
    await pool.close()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Os Gambitos do Algoritmo",
        version="0.1.0",
        description=("Real-time chess move analysis with explainable AI (XAI) feedback."),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router, prefix="/v1")
    app.add_exception_handler(AnalysisError, _analysis_error_handler)
    return app


async def _analysis_error_handler(_request: Request, error: Exception) -> JSONResponse:
    """Translate domain errors into a standard 400 response."""
    payload = ErrorResponse(error="invalid_request", detail=str(error))
    return JSONResponse(status_code=400, content=payload.model_dump())


app = create_app()
