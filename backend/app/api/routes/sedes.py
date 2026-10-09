from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Empresa, Sede
from app.schemas.sede import SedeEntrada, SedeSalida

router = APIRouter(prefix="/sedes", tags=["Sedes"])


@router.post("", response_model=SedeSalida, status_code=201)
def crear_sede(
    datos: SedeEntrada,
    db: Session = Depends(get_db),
):
    if db.get(Empresa, 1) is None:
        raise HTTPException(
            status_code=409,
            detail="Primero configura la empresa",
        )

    existente = db.scalar(
        select(Sede).where(Sede.codigo == datos.codigo)
    )

    if existente is not None:
        raise HTTPException(
            status_code=409,
            detail="Ya existe una sede con ese código",
        )

    sede = Sede(empresa_id=1, **datos.model_dump())
    db.add(sede)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo crear la sede por un conflicto de datos",
        ) from None

    db.refresh(sede)
    return sede


@router.get("", response_model=list[SedeSalida])
def listar_sedes(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = (
        select(Sede)
        .order_by(Sede.id)
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(consulta).all()


@router.get("/{sede_id}", response_model=SedeSalida)
def obtener_sede(
    sede_id: int,
    db: Session = Depends(get_db),
):
    sede = db.get(Sede, sede_id)

    if sede is None:
        raise HTTPException(
            status_code=404,
            detail="Sede no encontrada",
        )

    return sede