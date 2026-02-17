"""
Database initialization script.
Creates initial tenant and user for MVP.
"""

import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.models import Base, Tenant, User

settings = get_settings()


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


async def init_db() -> None:
    engine = create_async_engine(settings.database_url, echo=False)
    reset_db = _env_flag("RESET_DB", False)

    async with engine.begin() as conn:
        if reset_db:
            await conn.run_sync(Base.metadata.drop_all)
            print("[init_db] RESET_DB enabled: dropped existing tables.")
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant_result = await session.execute(
            select(Tenant).where(Tenant.subdomain == settings.default_tenant_subdomain).limit(1)
        )
        tenant = tenant_result.scalar_one_or_none()

        if tenant is None:
            tenant = Tenant(name=settings.default_tenant_name, subdomain=settings.default_tenant_subdomain)
            session.add(tenant)
            await session.flush()

        user_result = await session.execute(select(User).where(User.email == settings.default_admin_email).limit(1))
        user = user_result.scalar_one_or_none()
        if user is None:
            user = User(
                tenant_id=tenant.id,
                email=settings.default_admin_email,
                full_name="Admin User",
                hashed_password="hashed_password_here",
                role="admin",
                is_active=True,
            )
            session.add(user)

        await session.commit()
        print("Database initialized successfully.")
        print(f"  Tenant: {tenant.name} (ID: {tenant.id})")
        print(f"  User: {user.email} (ID: {user.id})")
        if not reset_db:
            print("  Existing data was preserved. Set RESET_DB=true to force a full reset.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_db())
