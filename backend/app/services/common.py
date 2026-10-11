from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError


def commit(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409, "Conflicto de datos: revisa códigos duplicados y referencias"
        ) from None


def row_out(row, exclude=()):
    return {
        col.key: (
            str(getattr(row, col.key))
            if isinstance(getattr(row, col.key), Decimal)
            else getattr(row, col.key)
        )
        for col in row.__table__.columns
        if col.key not in exclude
    }
