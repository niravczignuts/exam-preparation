from __future__ import annotations

import jwt
from fastapi import Header, HTTPException

from app.config import settings


def get_current_user_id(authorization: str = Header(...)) -> str:
    """Verifies the caller's Supabase Auth JWT and returns their user id.

    The frontend sends the access token from its Supabase session
    (`Authorization: Bearer <token>`). Routes that depend on this trust the
    returned user_id for scoping service-role reads/writes — the same
    explicit-scoping pattern app/jobs/daily_target_job.py already uses.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")

    if not settings.supabase_jwt_secret:
        raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET is not configured")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    return payload["sub"]
