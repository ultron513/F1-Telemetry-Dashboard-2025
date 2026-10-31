"""Entry point kept for `uvicorn main:app` compatibility."""

from app.main import app

__all__ = ["app"]
