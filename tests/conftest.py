import os

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-signing-key-that-is-at-least-thirty-two-characters")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.models import Base
from backend.app.seed import seed_demo_opportunities


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    test_settings = Settings(
        database_url="sqlite://",
        secret_key="test-signing-key-that-is-at-least-thirty-two-characters",
        cookie_secure=False,
        session_ttl_minutes=30,
    )
    app = create_app(settings=test_settings, engine=engine)
    with TestClient(app) as test_client:
        with app.state.session_factory() as session:
            seed_demo_opportunities(session)
        yield test_client
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def student_account(client: TestClient) -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "email": "student@example.edu",
            "password": "a-strong-prototype-password",
            "full_name": "Test Student",
            "major": "Environmental Studies",
        },
    )
    assert response.status_code == 201
    return response.json()
