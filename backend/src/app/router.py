"""HTTP endpoints for the analysis API."""

from fastapi import APIRouter, Depends, Request

from app.analysis import AnalysisService
from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    BestMoveRequest,
    BestMoveResponse,
    ConfigResponse,
    ErrorResponse,
    PositionEvalRequest,
    PositionEvalResponse,
)

router = APIRouter()


def get_analysis_service(request: Request) -> AnalysisService:
    """Provide the analysis service created in the app lifespan."""
    return request.app.state.analysis_service


@router.post(
    "/analysis",
    response_model=AnalysisResponse,
    responses={400: {"model": ErrorResponse}},
)
async def analyze(
    request: AnalysisRequest,
    service: AnalysisService = Depends(get_analysis_service),
) -> AnalysisResponse:
    """Analyse a played move and return didactic feedback."""
    return await service.analyze(request)


@router.get("/health")
async def health(
    service: AnalysisService = Depends(get_analysis_service),
) -> dict[str, str]:
    """Report whether the Stockfish engine pool is healthy."""
    healthy = await service.ping()
    return {"status": "ok" if healthy else "degraded"}


@router.post(
    "/best-move",
    response_model=BestMoveResponse,
    responses={400: {"model": ErrorResponse}},
)
async def best_move(
    request: BestMoveRequest,
    service: AnalysisService = Depends(get_analysis_service),
) -> BestMoveResponse:
    """Get the opponent's move at a difficulty level."""
    return await service.best_move(request)


@router.post(
    "/evaluate",
    response_model=PositionEvalResponse,
    responses={400: {"model": ErrorResponse}},
)
async def evaluate(
    request: PositionEvalRequest,
    service: AnalysisService = Depends(get_analysis_service),
) -> PositionEvalResponse:
    """Evaluate the current position for the advantage bar."""
    return await service.evaluate_position(request)


@router.get("/config", response_model=ConfigResponse)
async def get_config(
    service: AnalysisService = Depends(get_analysis_service),
) -> ConfigResponse:
    """Report optional runtime capabilities (e.g. Azure availability)."""
    return service.config()
