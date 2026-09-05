from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health() -> dict:
    """KAN-70 acceptance criterion: a minimal health-check endpoint that's
    deployed and reachable, proving the hosting choice actually works."""
    return {
        "status": "ok",
        "environment": settings.environment,
        # Lets the frontend hide the doubt-assistant/search/voice-checkin
        # controls instead of showing ones that would error out.
        "openai_configured": bool(settings.openai_api_key),
    }
