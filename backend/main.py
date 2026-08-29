"""Entry point for uvicorn main:app --reload (backward compatible)."""

from app.main import app

__all__ = ["app"]
