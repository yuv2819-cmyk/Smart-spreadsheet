from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.routers import datasets, ai, overview
from app.database import engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown
    await engine.dispose()

app = FastAPI(
    title="Smart Spreadsheet API",
    description="Backend service for the AI-Powered Smart Spreadsheet SaaS",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for frontend communication
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "https://*.vercel.app",  # Allow all Vercel preview deployments
]

# Allow environment variable override for custom domains
if os.getenv("ALLOWED_ORIGINS"):
    additional_origins = os.getenv("ALLOWED_ORIGINS").split(",")
    origins.extend(additional_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"https://.*\.vercel\.app",  # Regex for Vercel subdomain
)

# Include routers
# Include routers
app.include_router(datasets.router)
app.include_router(ai.router)
app.include_router(overview.router)

@app.get("/", tags=["Health"])
async def root():
    return {"message": "Smart Spreadsheet Backend API is running"}

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "environment": os.getenv("ENVIRONMENT", "development")}

