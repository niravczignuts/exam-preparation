from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict:
    """KAN-70 acceptance criterion: a minimal health-check endpoint that's
    deployed and reachable, proving the hosting choice actually works."""
    return {"status": "ok", "environment": settings.environment}
