from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import audit, require, site_access
from app.db.session import get_db
from app.models import Almacen, Empresa, Sede
from app.schemas.almacen import AlmacenEntrada
from app.schemas.empresa import EmpresaEntrada
from app.schemas.sede import SedeEntrada
from app.schemas.sistema import StatusInput
from app.services.common import commit, row_out

router = APIRouter(tags=["Organización"])


@router.get("/empresa")
def company(user=Depends(require("empresa.ver")), db: Session = Depends(get_db)):
    r = db.get(Empresa, 1)
    return row_out(r) if r else None


@router.put("/empresa")
def save_company(
    data: EmpresaEntrada, user=Depends(require("empresa.editar")), db: Session = Depends(get_db)
):
    r = db.get(Empresa, 1)
    if not r:
        r = Empresa(id=1)
        db.add(r)
    if r.moneda and r.moneda != data.moneda:
        from app.models import Purchase, Sale

        if db.scalar(select(Sale.id).limit(1)) or db.scalar(select(Purchase.id).limit(1)):
            raise HTTPException(409, "No cambies moneda después de registrar ventas o compras")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    audit(db, user, "editar", "empresa", 1)
    commit(db)
    return row_out(r)


@router.get("/sedes")
def sites(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("sedes.ver")),
    db: Session = Depends(get_db),
):
    q = select(Sede).order_by(Sede.id)
    if not user.propietario:
        q = q.where(Sede.id.in_(user.sedes))
    return [row_out(r) for r in db.scalars(q.offset(offset).limit(limit))]


@router.post("/sedes", status_code=201)
def create_site(
    data: SedeEntrada, user=Depends(require("sedes.editar")), db: Session = Depends(get_db)
):
    if not user.propietario:
        raise HTTPException(403, "Crear nuevas sedes requiere propietario")
    if not db.get(Empresa, 1):
        raise HTTPException(409, "Primero configura la empresa")
    r = Sede(empresa_id=1, **data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "sede", r.id)
    commit(db)
    return row_out(r)


@router.put("/sedes/{id}")
def edit_site(
    id: int, data: SedeEntrada, user=Depends(require("sedes.editar")), db: Session = Depends(get_db)
):
    site_access(user, id)
    r = db.get(Sede, id)
    if not r:
        raise HTTPException(404, "Sede no encontrada")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    audit(db, user, "editar", "sede", id)
    commit(db)
    return row_out(r)


@router.patch("/sedes/{id}/estado")
def site_status(
    id: int, data: StatusInput, user=Depends(require("sedes.editar")), db: Session = Depends(get_db)
):
    site_access(user, id)
    r = db.get(Sede, id)
    if not r:
        raise HTTPException(404, "Sede no encontrada")
    r.activo = data.activo
    audit(db, user, "estado", "sede", id)
    commit(db)
    return row_out(r)


@router.get("/almacenes")
def warehouses(
    sede_id: int | None = Query(None, gt=0),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("sedes.ver")),
    db: Session = Depends(get_db),
):
    q = select(Almacen).order_by(Almacen.id)
    if not user.propietario:
        q = q.where(Almacen.sede_id.in_(user.sedes))
    if sede_id:
        q = q.where(Almacen.sede_id == sede_id)
    return [
        dict(**row_out(r), sede=db.get(Sede, r.sede_id).nombre)
        for r in db.scalars(q.offset(offset).limit(limit))
    ]


@router.post("/almacenes", status_code=201)
def create_warehouse(
    data: AlmacenEntrada, user=Depends(require("sedes.editar")), db: Session = Depends(get_db)
):
    site_access(user, data.sede_id)
    s = db.get(Sede, data.sede_id)
    if not s:
        raise HTTPException(404, "Sede no encontrada")
    if not s.activo:
        raise HTTPException(409, "Sede inactiva")
    r = Almacen(**data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "almacen", r.id)
    commit(db)
    return row_out(r)


@router.put("/almacenes/{id}")
def edit_warehouse(
    id: int,
    data: AlmacenEntrada,
    user=Depends(require("sedes.editar")),
    db: Session = Depends(get_db),
):
    r = db.get(Almacen, id)
    if not r:
        raise HTTPException(404, "Almacén no encontrado")
    site_access(user, r.sede_id)
    if data.sede_id != r.sede_id:
        raise HTTPException(409, "No se puede mover un almacén de sede")
    r.codigo = data.codigo
    r.nombre = data.nombre
    audit(db, user, "editar", "almacen", id)
    commit(db)
    return row_out(r)


@router.patch("/almacenes/{id}/estado")
def warehouse_status(
    id: int, data: StatusInput, user=Depends(require("sedes.editar")), db: Session = Depends(get_db)
):
    r = db.get(Almacen, id)
    if not r:
        raise HTTPException(404, "Almacén no encontrado")
    site_access(user, r.sede_id)
    r.activo = data.activo
    audit(db, user, "estado", "almacen", id)
    commit(db)
    return row_out(r)
