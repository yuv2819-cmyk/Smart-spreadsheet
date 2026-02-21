from __future__ import annotations

import os
from pathlib import Path
import importlib

import pytest
from fastapi.testclient import TestClient


TEST_DB = Path("test_smart_spreadsheet.db")


@pytest.fixture(scope="session")
def client() -> TestClient:
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_smart_spreadsheet.db"
    os.environ["AUTO_CREATE_SCHEMA"] = "true"
    os.environ["AUTO_SEED_MVP_RECORDS"] = "true"
    os.environ["ALLOW_DEV_AUTH_FALLBACK"] = "true"
    os.environ["ENVIRONMENT"] = "development"
    os.environ["TRUSTED_HOSTS"] = "testserver,localhost,127.0.0.1"

    if TEST_DB.exists():
        TEST_DB.unlink()

    config_module = importlib.import_module("app.config")
    config_module.get_settings.cache_clear()

    main_module = importlib.import_module("app.main")
    app = main_module.app

    with TestClient(app) as test_client:
        yield test_client

    if TEST_DB.exists():
        TEST_DB.unlink()


@pytest.fixture(scope="session")
def auth_headers() -> dict[str, str]:
    return {
        "Authorization": "Bearer dev-insecure-token",
        "X-Tenant-Id": "1",
        "X-User-Id": "1",
    }
