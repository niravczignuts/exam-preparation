from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Loaded from environment variables / a local .env (never committed).

    See backend/.env.example for the full list and where each value comes from.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Path to the Firebase service account JSON (KAN-72). Never commit the
    # file itself — mount it as a secret file or paste its contents into this
    # env var's target platform (Render "Secret Files") at deploy time.
    firebase_service_account_path: str = ""


settings = Settings()
