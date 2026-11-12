from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import Engine

from backend.app.config import Settings
from backend.app.database import create_database_engine, create_session_factory
from backend.app.routes import router


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    resolved_settings = settings or Settings()
    resolved_engine = engine or create_database_engine(resolved_settings.database_url)
    app = FastAPI(title="Campus Research API", version="1.0.0")
    app.state.settings = resolved_settings
    app.state.engine = resolved_engine
    app.state.session_factory = create_session_factory(resolved_engine)
    app.include_router(router)

    frontend = Path(__file__).resolve().parents[2]
    app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    return app


app = create_app()
