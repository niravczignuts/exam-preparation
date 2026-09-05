from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache
def get_supabase() -> Client:
    """Service-role client — bypasses RLS. Backend/jobs only, never expose to the frontend."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. "
            "Copy backend/.env.example to backend/.env and fill them in "
            "(see supabase/README.md for where to find these values)."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
