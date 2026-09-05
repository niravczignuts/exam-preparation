from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Loaded from environment variables / a local .env (never committed).

    See backend/.env.example for the full list and where each value comes from.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # HS256 shared secret used to verify Supabase Auth JWTs (Project Settings
    # > API > JWT Settings). Lets the backend recover the caller's user_id
    # without round-tripping to Supabase on every request.
    supabase_jwt_secret: str = ""

    # Anthropic API key for LLM-based syllabus parsing (KAN-19).
    anthropic_api_key: str = ""

    # OpenAI API key for the doubt-solving chat assistant, Q&A bank semantic
    # search/dedup, and voice check-in transcription. Optional — every one of
    # those features stays hidden/disabled (not broken) if this is left blank.
    openai_api_key: str = ""

    # Path to the Firebase service account JSON (KAN-72). Never commit the
    # file itself — mount it as a secret file or paste its contents into this
    # env var's target platform (Render "Secret Files") at deploy time.
    firebase_service_account_path: str = ""


settings = Settings()
