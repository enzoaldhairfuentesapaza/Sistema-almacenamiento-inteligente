from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import audit, permissions, require, scoped, warehouse
from app.db.session import get_db
from app.models import Almacen, Movement, Product, Stock
from app.schemas.sistema import MoveInput
from app.services.common import commit, row_out
from app.services.inventario import delta, lock_products

router = APIRouter(tags=["Inventario"])


@router.get("/inventario")
def stock_list(
    almacen_id: int | None = Query(None, gt=0),
    producto_id: int | None = Query(None, gt=0),
    q: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("inventario.ver")),
    db: Session = Depends(get_db),
):
    query = scoped(
        select(Stock, Product, Almacen)
        .join(Product, Product.id == Stock.producto_id)
        .join(Almacen, Almacen.id == Stock.almacen_id),
        Stock.almacen_id,
        user,
    )
    if q:
        query = query.where(or_(Product.nombre.ilike(f"%{q}%"), Product.sku.ilike(f"%{q}%")))
    if almacen_id:
        warehouse(db, user, almacen_id, False)
        query = query.where(Stock.almacen_id == almacen_id)
    if producto_id:
        query = query.where(Stock.producto_id == producto_id)
    return [
        dict(
            id=s.id,
            producto_id=p.id,
            sku=p.sku,
            producto=p.nombre,
            almacen_id=a.id,
            almacen=a.nombre,
            sede_id=a.sede_id,
            cantidad=s.cantidad,
            stock_minimo=p.stock_minimo,
            alerta=s.cantidad <= p.stock_minimo,
        )
        for s, p, a in db.execute(query.order_by(Product.nombre).offset(offset).limit(limit))
    ]


@router.get("/movimientos")
def moves(
    almacen_id: int | None = Query(None, gt=0),
    producto_id: int | None = Query(None, gt=0),
    q: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("inventario.ver")),
    db: Session = Depends(get_db),
):
    query = scoped(
        select(Movement, Product.sku, Product.nombre, Almacen.nombre)
        .join(Product, Product.id == Movement.producto_id)
        .join(Almacen, Almacen.id == Movement.almacen_id),
        Movement.almacen_id,
        user,
    )
    if q:
        query = query.where(or_(Product.nombre.ilike(f"%{q}%"), Product.sku.ilike(f"%{q}%")))
    if almacen_id:
        warehouse(db, user, almacen_id, False)
        query = query.where(Movement.almacen_id == almacen_id)
    if producto_id:
        query = query.where(Movement.producto_id == producto_id)
    return [
        dict(**row_out(m), sku=sku, producto=pn, almacen=an)
        for m, sku, pn, an in db.execute(
            query.order_by(Movement.id.desc()).offset(offset).limit(limit)
        )
    ]


@router.post("/movimientos", status_code=201)
def move(data: MoveInput, user=Depends(require("inventario.mover")), db: Session = Depends(get_db)):
    if data.tipo in ("ajuste", "transferencia") and "inventario.ajustar" not in permissions(
        db, user
    ):
        raise HTTPException(403, "No tienes permiso para ajustes o transferencias")
    lock_products(db, [data.producto_id])
    if data.tipo == "transferencia":
        if not data.destino_id or data.destino_id == data.almacen_id:
            raise HTTPException(422, "Selecciona un almacén de destino diferente")
        warehouse(db, user, data.destino_id)
        a = delta(
            db,
            user,
            data.producto_id,
            data.almacen_id,
            -data.cantidad,
            "transferencia_salida",
            data.motivo,
            data.referencia,
        )
        b = delta(
            db,
            user,
            data.producto_id,
            data.destino_id,
            data.cantidad,
            "transferencia_entrada",
            data.motivo,
            f"TR-{a.id}",
        )
        a.referencia = f"TR-{b.id}"
        result = [a, b]
    else:
        if data.destino_id:
            raise HTTPException(422, "Destino solo aplica a transferencias")
        sign = (
            -1
            if data.tipo == "salida"
            or (data.tipo == "ajuste" and data.direccion_ajuste == "restar")
            else 1
        )
        result = [
            delta(
                db,
                user,
                data.producto_id,
                data.almacen_id,
                data.cantidad * sign,
                data.tipo,
                data.motivo,
                data.referencia,
            )
        ]
    audit(db, user, "movimiento", "inventario", result[0].id, data.motivo)
    commit(db)
    return [row_out(r) for r in result]
