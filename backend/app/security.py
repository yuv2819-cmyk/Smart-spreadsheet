from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
settings = get_settings()


def _resolve_jwt_secret() -> str:
    explicit_secret = (settings.auth_jwt_secret or "").strip()
    if explicit_secret:
        return explicit_secret

    # Development fallback to avoid blocking local setup.
    if settings.is_production:
        raise RuntimeError("AUTH_JWT_SECRET must be configured in production.")
    fallback = (settings.mvp_api_token or "dev-insecure-token").strip() or "dev-insecure-token"
    return f"{fallback}-jwt-secret"


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def create_access_token(
    *,
    user_id: int,
    tenant_id: int,
    role: str,
    expires_minutes: int | None = None,
) -> tuple[str, int]:
    expires_in_minutes = expires_minutes or settings.auth_access_token_expire_minutes
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)

    payload: dict[str, Any] = {
        "sub": str(user_id),
        "tenant_id": tenant_id,
        "role": role,
        "type": "access",
        "exp": expires_at,
        "iat": datetime.now(timezone.utc),
    }
    encoded = jwt.encode(payload, _resolve_jwt_secret(), algorithm=ALGORITHM)
    return encoded, expires_in_minutes * 60


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _resolve_jwt_secret(), algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc

    token_type = str(payload.get("type", ""))
    if token_type != "access":
        raise ValueError("Invalid token type")

    if "sub" not in payload or "tenant_id" not in payload:
        raise ValueError("Invalid token payload")

    return payload
