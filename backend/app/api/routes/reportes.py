from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require
from app.db.session import get_db
from app.services.module_reports import module_report

router = APIRouter(tags=["Estadísticas por sección"])


@router.get("/reportes/modulos/{modulo}")
def report(
    modulo: str,
    desde: date | None = None,
    hasta: date | None = None,
    user=Depends(require("reportes.ver")),
    db: Session = Depends(get_db),
):
    return module_report(db, user, modulo, desde, hasta)
