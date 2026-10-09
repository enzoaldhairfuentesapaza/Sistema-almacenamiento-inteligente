from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Empresa
from app.schemas.empresa import EmpresaEntrada, EmpresaSalida

router = APIRouter(prefix="/empresa", tags=["Empresa"])


@router.get("", response_model=EmpresaSalida)
def obtener_empresa(db: Session = Depends(get_db)):
    empresa = db.get(Empresa, 1)

    if empresa is None:
        raise HTTPException(
            status_code=404,
            detail="La empresa todavía no está configurada",
        )

    return empresa


@router.put("", response_model=EmpresaSalida)
def guardar_empresa(
    datos: EmpresaEntrada,
    db: Session = Depends(get_db),
):
    empresa = db.get(Empresa, 1)

    if empresa is None:
        empresa = Empresa(id=1, **datos.model_dump())
        db.add(empresa)
    else:
        for campo, valor in datos.model_dump().items():
            setattr(empresa, campo, valor)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo guardar por un conflicto de datos",
        ) from None

    db.refresh(empresa)
    return empresa