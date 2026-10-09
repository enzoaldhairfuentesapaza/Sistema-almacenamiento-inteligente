import logging

from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok"}


@router.get("/health/db", tags=["Sistema"])
def database_health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.warning("Falló la comprobación de conexión a PostgreSQL")
        raise HTTPException(
            status_code=503,
            detail="Base de datos no disponible",
        ) from None

    return {"status": "ok", "database": "connected"}