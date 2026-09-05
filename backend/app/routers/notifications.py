import logging
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.fcm import send_push

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class TestPushRequest(BaseModel):
    device_token: str
    title: str = "Exam Prep App"
    body: str = "Test notification"


class TestPushResponse(BaseModel):
    sent: bool
    message_id: Optional[str] = None
    error: Optional[str] = None


@router.post("/test-push", response_model=TestPushResponse)
def test_push(payload: TestPushRequest) -> TestPushResponse:
    """Manual verification hook for KAN-72's end-to-end acceptance criterion.

    Distinguishes "Firebase credentials aren't configured on this host" from
    "credentials are fine, the token/request itself was rejected" so this can
    be checked without needing a valid device token every time.
    """
    try:
        message_id = send_push(payload.device_token, payload.title, payload.body)
        return TestPushResponse(sent=True, message_id=message_id)
    except Exception as exc:
        logger.exception("test_push failed")
        return TestPushResponse(sent=False, error=str(exc))
