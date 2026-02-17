import hmac
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.security import decode_access_token

_bearer_scheme = HTTPBearer(auto_error=False)
settings = get_settings()


@dataclass(frozen=True)
class RequestContext:
    tenant_id: int
    user_id: int
    role: str


def _expected_api_token() -> str:
    token = (settings.mvp_api_token or "").strip()
    if token:
        return token

    if not settings.is_production and settings.allow_dev_auth_fallback:
        return "dev-insecure-token"

    return ""


def _unauthorized(detail: str = "Unauthorized") -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _extract_bearer_token(credentials: HTTPAuthorizationCredentials | None) -> str:
    if credentials and credentials.scheme.lower() == "bearer" and credentials.credentials:
        return credentials.credentials.strip()
    return ""


async def _get_user_or_forbidden(
    *,
    db: AsyncSession,
    user_id: int,
    tenant_id: int,
) -> User:
    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found or inactive")
    if user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to requested tenant",
        )
    return user


async def _authenticate_with_legacy_token(
    *,
    token: str,
    x_tenant_id: int | None,
    x_user_id: int | None,
    db: AsyncSession,
) -> User:
    expected_token = _expected_api_token()
    if not expected_token:
        _unauthorized()
    if not hmac.compare_digest(token, expected_token):
        _unauthorized()

    tenant_id = x_tenant_id or 1
    user_id = x_user_id or 1
    return await _get_user_or_forbidden(db=db, user_id=user_id, tenant_id=tenant_id)


async def _authenticate_with_jwt(
    *,
    token: str,
    db: AsyncSession,
) -> User:
    try:
        claims = decode_access_token(token)
    except ValueError:
        _unauthorized("Invalid or expired token.")

    try:
        user_id = int(claims["sub"])
        tenant_id = int(claims["tenant_id"])
    except (ValueError, TypeError, KeyError):
        _unauthorized("Invalid token payload.")

    return await _get_user_or_forbidden(db=db, user_id=user_id, tenant_id=tenant_id)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    x_tenant_id: int | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = _extract_bearer_token(credentials)
    if not token:
        _unauthorized()

    expected_token = _expected_api_token()
    if expected_token and hmac.compare_digest(token, expected_token):
        return await _authenticate_with_legacy_token(
            token=token,
            x_tenant_id=x_tenant_id,
            x_user_id=x_user_id,
            db=db,
        )

    return await _authenticate_with_jwt(token=token, db=db)


async def get_request_context(
    current_user: User = Depends(get_current_user),
) -> RequestContext:
    return RequestContext(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        role=current_user.role,
    )
