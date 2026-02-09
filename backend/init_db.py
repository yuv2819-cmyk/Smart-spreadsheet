"""
Database initialization script
Creates initial tenant and user for MVP
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.models import Base, Tenant, User
from app.database import DATABASE_URL
import os

async def init_db():
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Create default tenant
        tenant = Tenant(
            name="Demo Company",
            subdomain="demo"
        )
        session.add(tenant)
        await session.flush()
        
        # Create default user
        user = User(
            tenant_id=tenant.id,
            email="admin@demo.com",
            full_name="Admin User",
            hashed_password="hashed_password_here",  # In production, use proper hashing
            role="admin"
        )
        session.add(user)
        
        await session.commit()
        print("✅ Database initialized successfully!")
        print(f"   Tenant: {tenant.name} (ID: {tenant.id})")
        print(f"   User: {user.email} (ID: {user.id})")

if __name__ == "__main__":
    asyncio.run(init_db())
