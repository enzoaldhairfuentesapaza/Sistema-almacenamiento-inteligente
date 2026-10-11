from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.security import permissions, scoped
from app.models import Almacen, Empresa, Product, Sale, SaleLine, Stock


def local_date(moment, zone):
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(zone).date()


def sales_series(db, user, product_id=None):
    company = db.get(Empresa, 1)
    zone = ZoneInfo(company.zona_horaria if company else "America/Lima")
    values = defaultdict(float)
    if product_id:
        q = scoped(
            select(Sale, SaleLine)
            .join(SaleLine, SaleLine.venta_id == Sale.id)
            .where(Sale.estado == "confirmada", SaleLine.producto_id == product_id),
            Sale.almacen_id,
            user,
        )
        for s, line in db.execute(q):
            values[local_date(s.fecha, zone)] += float(line.cantidad)
    else:
        q = scoped(select(Sale).where(Sale.estado == "confirmada"), Sale.almacen_id, user)
        for s in db.scalars(q):
            values[local_date(s.fecha, zone)] += float(s.total)
    return values, zone


def summary(db, user):
    stocks = list(
        db.execute(
            scoped(
                select(Stock, Product).join(Product, Product.id == Stock.producto_id),
                Stock.almacen_id,
                user,
            )
        )
    )
    sales = list(
        db.scalars(scoped(select(Sale).where(Sale.estado == "confirmada"), Sale.almacen_id, user))
    )
    vals, zone = sales_series(db, user)
    today = datetime.now(zone).date()
    total = sum((s.total for s in sales), Decimal(0))
    days = [today - timedelta(days=i) for i in range(29, -1, -1)]
    counts = defaultdict(float)
    for s, line in db.execute(
        scoped(
            select(Sale, SaleLine)
            .join(SaleLine, SaleLine.venta_id == Sale.id)
            .where(Sale.estado == "confirmada"),
            Sale.almacen_id,
            user,
        )
    ):
        counts[line.nombre] += float(line.cantidad)
    out = {
        "productos": len(list(db.scalars(select(Product.id).where(Product.activo.is_(True))))),
        "unidades": sum(float(s.cantidad) for s, p in stocks),
        "ventas_total": total,
        "ventas_hoy": vals[today],
        "pendiente": sum((s.total - s.pagado for s in sales), Decimal(0)),
        "alertas": [
            {
                "producto_id": p.id,
                "sku": p.sku,
                "nombre": p.nombre,
                "almacen_id": s.almacen_id,
                "almacen": db.get(Almacen, s.almacen_id).nombre,
                "cantidad": s.cantidad,
                "minimo": p.stock_minimo,
            }
            for s, p in stocks
            if p.activo and s.cantidad <= p.stock_minimo
        ],
        "serie": [{"fecha": d.isoformat(), "valor": round(vals[d], 2)} for d in days],
        "ranking": [
            {"nombre": k, "cantidad": v}
            for k, v in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ],
    }
    if "costos.ver" in permissions(db, user):
        out["valor_inventario"] = sum((s.cantidad * p.costo for s, p in stocks), Decimal(0))
    return out
