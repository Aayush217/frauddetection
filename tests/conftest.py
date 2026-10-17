import os
import sys
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

# Add backend directory to sys.path
backend_path = str(Path(__file__).resolve().parent.parent / "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.core.config import settings
from app.core.security import create_access_token
from app.db.neo4j import init_schema
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_schema():
    """Ensure Neo4j constraints and indexes are established prior to tests."""
    init_schema()


@pytest.fixture
def admin_token() -> str:
    """Generate valid JWT token with admin role."""
    return create_access_token({"sub": settings.ADMIN_USERNAME, "role": "admin"})


@pytest.fixture
def analyst_token() -> str:
    """Generate valid JWT token with analyst role."""
    return create_access_token({"sub": settings.ANALYST_USERNAME, "role": "analyst"})


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def analyst_headers(analyst_token: str) -> dict:
    return {"Authorization": f"Bearer {analyst_token}"}


@pytest.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
