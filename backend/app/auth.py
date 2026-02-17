import hmac
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User

_bearer_scheme = HTTPBearer(auto_error=False)
settings = get_settings()


@dataclass(frozen=True)
class RequestContext:
    tenant_id: int
    user_id: int


def _expected_api_token() -> str:
    token = (settings.mvp_api_token or "").strip()

    if token:
        return token

    if settings.is_production or not settings.allow_dev_auth_fallback:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MVP_API_TOKEN is required in production",
        )

    # Development fallback to avoid blocking local setup.
    return "dev-insecure-token"


def _unauthorized() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_request_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    x_tenant_id: int | None = Header(default=None, alias="X-Tenant-Id"),
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
) -> RequestContext:
    expected_token = _expected_api_token()
    presented_token = ""

    if credentials and credentials.scheme.lower() == "bearer":
        presented_token = credentials.credentials.strip()

    if not presented_token or not hmac.compare_digest(presented_token, expected_token):
        _unauthorized()

    tenant_id = x_tenant_id or 1
    user_id = x_user_id or 1

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found or inactive")

    if user.tenant_id != tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to requested tenant",
        )

    return RequestContext(tenant_id=tenant_id, user_id=user_id)
