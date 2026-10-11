from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import warehouse
from app.models import Movement, Product, Stock


def lock_products(db, ids):
    # One lock per product serializes changes even before its first stock row exists.
    products = {
        p.id: p
        for p in db.scalars(
            select(Product)
            .where(Product.id.in_(set(ids)))
            .order_by(Product.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    }
    if len(products) != len(set(ids)):
        raise HTTPException(404, "Producto inexistente")
    return products


def delta(
    db, user, product_id, warehouse_id, amount, kind, reason, reference="", allow_inactive=False
):
    warehouse(db, user, warehouse_id, active=not allow_inactive)
    p = db.get(Product, product_id)
    if not p or (not p.activo and not allow_inactive):
        raise HTTPException(409, "Producto inexistente o inactivo")
    stock = db.scalar(
        select(Stock)
        .where(Stock.producto_id == product_id, Stock.almacen_id == warehouse_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not stock:
        stock = Stock(producto_id=product_id, almacen_id=warehouse_id, cantidad=Decimal("0"))
        db.add(stock)
    new = stock.cantidad + amount
    if new < 0:
        raise HTTPException(409, f"Stock insuficiente para {p.sku}; disponible: {stock.cantidad}")
    if new >= Decimal("100000000000"):
        raise HTTPException(422, "Cantidad fuera de rango")
    stock.cantidad = new
    m = Movement(
        producto_id=product_id,
        almacen_id=warehouse_id,
        cantidad=amount,
        saldo=new,
        tipo=kind,
        motivo=reason,
        referencia=reference,
        usuario_id=user.id,
    )
    db.add(m)
    db.flush()
    return m
