from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Almacen, Sede
from app.schemas.almacen import AlmacenEntrada, AlmacenSalida

router = APIRouter(prefix="/almacenes", tags=["Almacenes"])


@router.post("", response_model=AlmacenSalida, status_code=201)
def crear_almacen(
    datos: AlmacenEntrada,
    db: Session = Depends(get_db),
):
    sede = db.get(Sede, datos.sede_id)

    if sede is None:
        raise HTTPException(
            status_code=404,
            detail="Sede no encontrada",
        )

    if not sede.activo:
        raise HTTPException(
            status_code=409,
            detail="No puedes crear almacenes en una sede inactiva",
        )

    existente = db.scalar(
        select(Almacen).where(
            Almacen.sede_id == datos.sede_id,
            Almacen.codigo == datos.codigo,
        )
    )

    if existente is not None:
        raise HTTPException(
            status_code=409,
            detail="Ya existe un almacén con ese código en la sede",
        )

    almacen = Almacen(**datos.model_dump())
    db.add(almacen)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo crear el almacén por un conflicto de datos",
        ) from None

    db.refresh(almacen)
    return almacen


@router.get("", response_model=list[AlmacenSalida])
def listar_almacenes(
    sede_id: int | None = Query(default=None, gt=0),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = select(Almacen)

    if sede_id is not None:
        consulta = consulta.where(Almacen.sede_id == sede_id)

    consulta = (
        consulta.order_by(Almacen.id)
        .offset(offset)
        .limit(limit)
    )
    return db.scalars(consulta).all()


@router.get("/{almacen_id}", response_model=AlmacenSalida)
def obtener_almacen(
    almacen_id: int,
    db: Session = Depends(get_db),
):
    almacen = db.get(Almacen, almacen_id)

    if almacen is None:
        raise HTTPException(
            status_code=404,
            detail="Almacén no encontrado",
        )

    return almacen