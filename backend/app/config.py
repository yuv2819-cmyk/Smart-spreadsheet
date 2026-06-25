from functools import lru_cache
from typing import Literal

from pydantic import Field, ValidationError, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        # We accept comma-separated strings for list settings (see _split_csv).
        # Disabling decoding avoids pydantic-settings trying to JSON-decode list fields.
        enable_decoding=False,
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"
    database_url: str = "sqlite+aiosqlite:///./smart_spreadsheet.db"
    sql_echo: bool = False
    auto_create_schema: bool = True
    # Example seeding is opt-in. A real SaaS flow should start with signup.
    auto_seed_mvp_records: bool = False

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"

    auth_jwt_secret: str | None = None
    auth_access_token_expire_minutes: int = 60 * 24

    mvp_api_token: str | None = None
    # Legacy service-token fallback is opt-in for local dev only.
    allow_dev_auth_fallback: bool = False

    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    allow_vercel_preview_origins: bool = True
    # Include the Docker Compose service hostname so the Next.js proxy can reach the API.
    trusted_hosts: list[str] = Field(default_factory=lambda: ["localhost", "127.0.0.1", "backend"])
    enable_https_redirect: bool = False
    enable_api_docs: bool = True

    max_upload_size_bytes: int = 10 * 1024 * 1024
    max_upload_rows: int = 250000
    max_upload_columns: int = 250
    max_upload_cell_length: int = 10000
    overview_cache_ttl_seconds: int = 30
    redis_url: str | None = None
    rate_limit_backend: Literal["auto", "memory", "redis"] = "auto"
    enable_connector_scheduler: bool = True
    run_schedulers: bool = False
    connector_scheduler_interval_seconds: int = 120
    connector_sync_trigger_secret: str | None = None

    # Only used when AUTO_SEED_MVP_RECORDS or init_db example seeding is enabled.
    default_tenant_name: str = "Example Company"
    default_tenant_subdomain: str = "workspace"
    default_admin_email: str = "admin@example.com"
    default_admin_password: str = "change-me"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: object) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            return str(value)

        url = value.strip()
        if not url:
            return ""

        if "://" not in url:
            return url

        scheme, rest = url.split("://", 1)
        normalized_scheme = scheme

        # Common managed Postgres providers (Railway/Render/etc.) expose `postgres://` or `postgresql://`.
        # Our app uses SQLAlchemy async engine, so normalize to `postgresql+asyncpg://`.
        if scheme in {"postgres", "postgresql"}:
            normalized_scheme = "postgresql+asyncpg"

        # Developers sometimes provide sync sqlite URLs; normalize to async driver.
        if scheme == "sqlite":
            normalized_scheme = "sqlite+aiosqlite"

        if normalized_scheme == scheme:
            return url
        return f"{normalized_scheme}://{rest}"

    @field_validator("allowed_origins", "trusted_hosts", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return []

    @field_validator("redis_url", "connector_sync_trigger_secret", mode="before")
    @classmethod
    def _normalize_optional_string(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def _validate_for_environment(self) -> "Settings":
        if self.environment != "development" and self.allow_dev_auth_fallback:
            raise ValueError("ALLOW_DEV_AUTH_FALLBACK is only permitted in development.")

        if self.environment == "production":
            if self.mvp_api_token and self.mvp_api_token == "dev-insecure-token":
                raise ValueError("MVP_API_TOKEN cannot use the development fallback in production.")
            if not self.auth_jwt_secret:
                raise ValueError("AUTH_JWT_SECRET is required in production.")
            if len(self.auth_jwt_secret.strip()) < 32:
                raise ValueError("AUTH_JWT_SECRET must be at least 32 characters in production.")
            if self.auto_create_schema:
                raise ValueError("AUTO_CREATE_SCHEMA must be false in production. Run Alembic migrations instead.")
            if not self.allowed_origins:
                raise ValueError("ALLOWED_ORIGINS must be set in production.")
            if any(origin == "*" for origin in self.allowed_origins):
                raise ValueError("ALLOWED_ORIGINS cannot contain '*' in production.")
            if self.trusted_hosts == ["localhost", "127.0.0.1"]:
                raise ValueError("TRUSTED_HOSTS must be configured for production domains.")
            if any(host == "*" for host in self.trusted_hosts):
                raise ValueError("TRUSTED_HOSTS cannot contain '*' in production.")
            if self.database_url.startswith("sqlite"):
                raise ValueError("SQLite is not supported for production. Use PostgreSQL.")
            if self.rate_limit_backend == "memory":
                raise ValueError("RATE_LIMIT_BACKEND=memory is not allowed in production. Use Redis.")
            if self.rate_limit_backend in {"auto", "redis"} and not self.redis_url:
                raise ValueError("REDIS_URL is required in production for distributed rate limiting.")
            if not self.connector_sync_trigger_secret or len(self.connector_sync_trigger_secret) < 16:
                raise ValueError(
                    "CONNECTOR_SYNC_TRIGGER_SECRET is required in production and must be at least 16 characters."
                )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        settings = Settings()
    except ValidationError as exc:
        raise RuntimeError(f"Invalid configuration: {exc}") from exc

    if settings.is_production:
        settings.auto_seed_mvp_records = False
        if settings.enable_https_redirect is False:
            settings.enable_https_redirect = True
        if settings.enable_api_docs:
            settings.enable_api_docs = False
        if settings.allow_vercel_preview_origins:
            settings.allow_vercel_preview_origins = False
        if settings.rate_limit_backend == "auto":
            settings.rate_limit_backend = "redis"
        # Schedulers should run only on explicitly designated worker processes.
        if not settings.run_schedulers:
            settings.enable_connector_scheduler = False

    return settings
