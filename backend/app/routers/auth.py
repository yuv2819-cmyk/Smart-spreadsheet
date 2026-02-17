import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Tenant, User
from app.schemas import (
    AuthSignInRequest,
    AuthSignUpRequest,
    AuthTokenResponse,
    AuthUser,
)
from app.security import create_access_token, get_password_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _slugify_subdomain(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9-]+", "-", value.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:60] or "workspace"


async def _generate_unique_subdomain(db: AsyncSession, seed: str) -> str:
    base = _slugify_subdomain(seed)
    candidate = base
    suffix = 1

    while True:
        result = await db.execute(select(Tenant.id).where(Tenant.subdomain == candidate).limit(1))
        if result.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base}-{suffix}"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _build_auth_response(user: User) -> AuthTokenResponse:
    token, expires_in = create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        role=user.role,
    )
    return AuthTokenResponse(
        access_token=token,
        expires_in=expires_in,
        user=AuthUser.model_validate(user),
    )


@router.post("/signup", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: AuthSignUpRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new tenant workspace and admin user account."""
    email = _normalize_email(payload.email)
    existing_user = await db.execute(select(User).where(User.email == email).limit(1))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    workspace_name = (payload.workspace_name or "").strip() or f"{(payload.full_name or 'New')} Workspace"
    subdomain_seed = workspace_name if workspace_name else email.split("@")[0]
    unique_subdomain = await _generate_unique_subdomain(db, subdomain_seed)

    tenant = Tenant(name=workspace_name, subdomain=unique_subdomain)
    db.add(tenant)
    await db.flush()

    user = User(
        tenant_id=tenant.id,
        email=email,
        full_name=(payload.full_name or "").strip() or None,
        hashed_password=get_password_hash(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _build_auth_response(user)


@router.post("/signin", response_model=AuthTokenResponse)
async def signin(
    payload: AuthSignInRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate a user and return an access token."""
    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email).limit(1))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive.")
    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return _build_auth_response(user)


@router.post("/logout")
async def logout():
    """Stateless JWT logout endpoint for client workflow symmetry."""
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=AuthUser)
async def me(current_user: User = Depends(get_current_user)):
    return AuthUser.model_validate(current_user)
