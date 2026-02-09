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
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

