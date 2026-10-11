"""HTTP endpoints for the analysis API."""

from fastapi import APIRouter, Depends, Request

from app.analysis import AnalysisService
from app.models import AnalysisRequest, AnalysisResponse, ErrorResponse

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
