from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import get_settings
from app.database import AsyncSessionLocal, Base, engine
from app.middleware import RequestIdMiddleware, SecurityHeadersMiddleware
from app.models import Tenant, User
from app.routers import ai, auth, datasets, overview
from app.security import get_password_hash

settings = get_settings()
logger = logging.getLogger("app.main")


def _configure_logging() -> None:
    level = logging.INFO if settings.is_production else logging.DEBUG
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


async def ensure_default_mvp_records() -> None:
    """Seed a single demo tenant/user for local MVP mode."""
    if not settings.auto_seed_mvp_records:
        return

    async with AsyncSessionLocal() as session:
        tenant = await session.get(Tenant, 1)
        if tenant is None:
            subdomain = settings.default_tenant_subdomain
            subdomain_exists = await session.execute(
                select(Tenant).where(Tenant.subdomain == subdomain).limit(1)
            )
            if subdomain_exists.scalar_one_or_none():
                subdomain = f"{subdomain}-mvp"
            session.add(Tenant(id=1, name=settings.default_tenant_name, subdomain=subdomain))

        user = await session.get(User, 1)
        if user is None:
            email = settings.default_admin_email
            email_exists = await session.execute(select(User).where(User.email == email).limit(1))
            if email_exists.scalar_one_or_none():
                email = "mvp-admin@example.local"
            session.add(
                User(
                    id=1,
                    tenant_id=1,
                    email=email,
                    full_name="Admin User",
                    hashed_password=get_password_hash(settings.default_admin_password),
                    role="admin",
                    is_active=True,
                )
            )
        elif user.hashed_password in {"mvp-placeholder-password", "hashed_password_here"}:
            user.hashed_password = get_password_hash(settings.default_admin_password)
        await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _configure_logging()
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    await ensure_default_mvp_records()
    logger.info("Application started in %s mode", settings.environment)
    yield
    await engine.dispose()


app = FastAPI(
    title="Smart Spreadsheet API",
    description="Backend service for the AI-Powered Smart Spreadsheet SaaS",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts or ["*"])

if settings.enable_https_redirect:
    app.add_middleware(HTTPSRedirectMiddleware)

allow_origin_regex = r"https://.*\.vercel\.app" if settings.allow_vercel_preview_origins else None
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id", "X-User-Id", "X-Request-Id"],
    allow_origin_regex=allow_origin_regex,
)

app.include_router(datasets.router)
app.include_router(ai.router)
app.include_router(overview.router)
app.include_router(auth.router)


@app.get("/", tags=["Health"])
async def root():
    return {"message": "Smart Spreadsheet Backend API is running"}


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "environment": settings.environment}


@app.get("/ready", tags=["Health"])
async def readiness_check():
    async with AsyncSessionLocal() as session:  # type: AsyncSession
        await session.execute(text("SELECT 1"))
    return {"status": "ready"}
