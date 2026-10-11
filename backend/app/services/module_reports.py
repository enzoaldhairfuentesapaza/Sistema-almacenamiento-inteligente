"""Module reports: explicit reading permissions, site scope and local-date periods."""

from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select

from app.core.security import permissions, scoped
from app.models import (
    Almacen,
    Audit,
    Category,
    Contact,
    Empresa,
    ImportJob,
    Movement,
    Product,
    ProductType,
    Purchase,
    PurchaseLine,
    Role,
    Sale,
    SaleLine,
    Sede,
    Stock,
    User,
)
from app.services.analytics import local_date

MODULES = {
    "productos": ("Productos", {"productos.ver"}),
    "inventario": ("Inventario", {"inventario.ver"}),
    "ventas": ("Ventas y cobros", {"ventas.ver"}),
    "compras": ("Compras", {"compras.ver", "costos.ver"}),
    "contactos": ("Clientes y proveedores", {"contactos.ver"}),
    "organizacion": ("Empresa y ubicaciones", {"sedes.ver"}),
    "accesos": ("Usuarios y permisos", set()),
    "auditoria": ("Auditoría", set()),
    "excel": ("Importar y exportar", set()),
}


def module_report(db, user, module: str, since: date | None, until: date | None):
    if module not in MODULES:
        raise HTTPException(404, "Sección de estadísticas inexistente")
    perms = permissions(db, user)
    if "reportes.ver" not in perms or not MODULES[module][1].issubset(perms):
        raise HTTPException(403, "No tienes permiso para estas estadísticas")
    if module in ("accesos", "auditoria") and not user.propietario:
        raise HTTPException(403, "Estas estadísticas están reservadas al propietario")
    if module == "excel" and not ({"excel.importar", "excel.exportar"} & perms):
        raise HTTPException(403, "No tienes acceso a importación o exportación")
    company = db.get(Empresa, 1)
    zone = ZoneInfo(company.zona_horaria if company else "America/Lima")
    today = datetime.now(zone).date()
    until = until or today
    since = since or until - timedelta(days=29)
    if since > until or (until - since).days > 365:
        raise HTTPException(422, "Elige un período ordenado de hasta 366 días")
    start = datetime.combine(since, time.min, zone).astimezone(timezone.utc)
    end = datetime.combine(until + timedelta(days=1), time.min, zone).astimezone(timezone.utc)
    metrics, groups, series = [], [], defaultdict(lambda: Decimal(0))
    group_title = "Distribución"
    note = "El período aplica a las operaciones; el catálogo y los saldos son actuales."

    def metric(label, value, kind="numero"):
        metrics.append({"etiqueta": label, "valor": value, "tipo": kind})

    def grouped(values):
        return [{"etiqueta": key, "valor": value} for key, value in values.items()]

    def period(query, model):
        return query.where(model.fecha >= start, model.fecha < end)

    if module == "productos":
        rows = list(db.scalars(select(Product)))
        cats = {r.id: r.nombre for r in db.scalars(select(Category))}
        metric("Productos registrados", len(rows))
        metric("Activos", sum(p.activo for p in rows))
        metric("Archivados", sum(not p.activo for p in rows))
        metric("Variantes", sum(p.producto_padre_id is not None for p in rows))
        metric(
            "Precio promedio activo",
            sum((p.precio for p in rows if p.activo), Decimal(0))
            / max(1, sum(p.activo for p in rows)),
            "moneda",
        )
        metric("Tipos configurados", len(list(db.scalars(select(ProductType.id)))))
        groups = grouped(Counter(cats.get(p.categoria_id, "Sin categoría") for p in rows))
        group_title = "Productos por categoría (incluye archivados)"
        note = "Catálogo actual de la instalación. Los precios son precios de venta, sin impuesto adicional."
    elif module == "inventario":
        rows = list(
            db.execute(
                scoped(
                    select(Stock, Product, Almacen)
                    .join(Product, Product.id == Stock.producto_id)
                    .join(Almacen, Almacen.id == Stock.almacen_id),
                    Stock.almacen_id,
                    user,
                )
            )
        )
        metric("Productos con saldo registrado", len({p.id for s, p, a in rows}))
        metric("Registros con stock disponible", sum(s.cantidad > 0 for s, p, a in rows))
        metric("Registros agotados", sum(s.cantidad == 0 and p.activo for s, p, a in rows))
        metric(
            "Registros bajo mínimo",
            sum(s.cantidad <= p.stock_minimo and p.activo for s, p, a in rows),
        )
        by_store = Counter(a.nombre for s, p, a in rows if s.cantidad > 0)
        groups = grouped(by_store)
        group_title = "Productos disponibles por almacén"
        moves = list(
            db.scalars(period(scoped(select(Movement), Movement.almacen_id, user), Movement))
        )
        metric("Movimientos del período", len(moves))
        for m in moves:
            series[local_date(m.fecha, zone)] += 1
        if "costos.ver" in perms:
            metric(
                "Valor actual a costo de catálogo",
                sum((s.cantidad * p.costo for s, p, a in rows), Decimal(0)),
                "moneda",
            )
        note = "Cada saldo corresponde a un producto y almacén. No se suman cantidades de unidades distintas. La valoración usa el costo actual del catálogo."
    elif module == "ventas":
        sales = list(db.scalars(period(scoped(select(Sale), Sale.almacen_id, user), Sale)))
        confirmed = [s for s in sales if s.estado == "confirmada"]
        total = sum((s.total for s in confirmed), Decimal(0))
        metric("Ventas confirmadas", len(confirmed))
        metric("Ventas anuladas", len(sales) - len(confirmed))
        metric("Importe confirmado", total, "moneda")
        metric("Cobrado de estas ventas", sum((s.pagado for s in confirmed), Decimal(0)), "moneda")
        metric(
            "Pendiente de estas ventas",
            sum((s.total - s.pagado for s in confirmed), Decimal(0)),
            "moneda",
        )
        metric("Ticket promedio", total / max(1, len(confirmed)), "moneda")
        ranking = defaultdict(lambda: Decimal(0))
        for s, line in db.execute(
            period(
                scoped(
                    select(Sale, SaleLine)
                    .join(SaleLine, SaleLine.venta_id == Sale.id)
                    .where(Sale.estado == "confirmada"),
                    Sale.almacen_id,
                    user,
                ),
                Sale,
            )
        ):
            ranking[f"{line.sku} · {line.nombre}"] += line.importe
        groups = grouped(dict(sorted(ranking.items(), key=lambda x: x[1], reverse=True)[:10]))
        group_title = "Productos por importe vendido (antes de impuesto)"
        for s in confirmed:
            series[local_date(s.fecha, zone)] += s.total
        note = "Las ventas corresponden al período seleccionado. Cobrado y pendiente reflejan el estado actual de esas ventas; las anuladas se excluyen de los importes."
    elif module == "compras":
        purchases = list(
            db.scalars(period(scoped(select(Purchase), Purchase.almacen_id, user), Purchase))
        )
        contacts = {
            c.id: c.nombre for c in db.scalars(select(Contact).where(Contact.tipo == "proveedor"))
        }
        metric("Recepciones", len(purchases))
        metric("Importe recibido", sum((p.total for p in purchases), Decimal(0)), "moneda")
        metric("Proveedores del período", len({p.proveedor_id for p in purchases}))
        metric(
            "Productos recibidos",
            len(
                {
                    line.producto_id
                    for p, line in db.execute(
                        period(
                            scoped(
                                select(Purchase, PurchaseLine).join(
                                    PurchaseLine, PurchaseLine.compra_id == Purchase.id
                                ),
                                Purchase.almacen_id,
                                user,
                            ),
                            Purchase,
                        )
                    )
                }
            ),
        )
        by_supplier = defaultdict(lambda: Decimal(0))
        for p in purchases:
            by_supplier[contacts.get(p.proveedor_id, "Proveedor")] += p.total
            series[local_date(p.fecha, zone)] += p.total
        groups = grouped(dict(sorted(by_supplier.items(), key=lambda x: x[1], reverse=True)[:10]))
        group_title = "Importe recibido por proveedor"
    elif module == "contactos":
        rows = list(db.scalars(select(Contact)))
        metric("Clientes", sum(c.tipo == "cliente" for c in rows))
        metric("Proveedores", sum(c.tipo == "proveedor" for c in rows))
        metric("Contactos activos", sum(c.activo for c in rows))
        metric("Contactos inactivos", sum(not c.activo for c in rows))
        groups = grouped(
            Counter("Clientes" if c.tipo == "cliente" else "Proveedores" for c in rows)
        )
        group_title = "Directorio actual"
        note = "Directorio actual de la instalación; el período no modifica estos conteos."
    elif module == "organizacion":
        site_query = select(Sede)
        if not user.propietario:
            site_query = site_query.where(Sede.id.in_(user.sedes))
        sites = list(db.scalars(site_query))
        stores = list(db.scalars(select(Almacen).where(Almacen.sede_id.in_([s.id for s in sites]))))
        metric("Sedes autorizadas", len(sites))
        metric("Sedes activas", sum(s.activo for s in sites))
        metric("Almacenes autorizados", len(stores))
        metric("Almacenes activos", sum(a.activo for a in stores))
        names = {s.id: s.nombre for s in sites}
        groups = grouped(Counter(names[a.sede_id] for a in stores))
        group_title = "Almacenes por sede"
        note = "Ubicaciones actuales dentro de tus sedes asignadas."
    elif module == "accesos":
        users = list(db.scalars(select(User)))
        roles = list(db.scalars(select(Role)))
        metric("Usuarios", len(users))
        metric("Usuarios activos", sum(u.activo for u in users))
        metric("Usuarios bloqueados", sum(not u.activo for u in users))
        metric("Roles configurados", len(roles))
        names = {r.id: r.nombre for r in roles}
        counter = Counter()
        for u in users:
            if u.propietario:
                counter["Propietario"] += 1
            for role in u.roles:
                counter[names.get(role, "Rol no disponible")] += 1
        groups = grouped(counter)
        group_title = "Asignaciones de roles (un usuario puede tener varios)"
        note = "Usuarios y roles actuales; no se muestran contraseñas ni sesiones."
    elif module == "auditoria":
        rows = list(db.scalars(period(select(Audit), Audit)))
        metric("Eventos del período", len(rows))
        metric("Usuarios con actividad", len({a.usuario_id for a in rows if a.usuario_id}))
        metric("Inicios de sesión", sum(a.accion == "login" for a in rows))
        metric("Operaciones de eliminación", sum(a.accion == "eliminar" for a in rows))
        groups = grouped(Counter(a.accion.replace("_", " ") for a in rows))
        group_title = "Eventos por acción"
        for a in rows:
            series[local_date(a.fecha, zone)] += 1
    elif module == "excel":
        imports = list(
            db.scalars(period(select(ImportJob).where(ImportJob.usuario_id == user.id), ImportJob))
        )
        exports = list(
            db.scalars(
                period(
                    select(Audit).where(Audit.usuario_id == user.id, Audit.accion == "exportar"),
                    Audit,
                )
            )
        )
        metric("Mis importaciones", len(imports))
        metric("Filas importadas por mí", sum(j.filas for j in imports))
        metric("Mis exportaciones", len(exports))
        groups = grouped(Counter(e.entidad for e in exports))
        group_title = "Mis exportaciones por conjunto de datos"
        for job in imports:
            series[local_date(job.fecha, zone)] += job.filas
        note = (
            "Solo tus operaciones en el período. Las prevalidaciones no cuentan como importaciones."
        )
    monetary = module in ("ventas", "compras")
    dates = [since + timedelta(days=i) for i in range((until - since).days + 1)]
    return {
        "modulo": module,
        "titulo": MODULES[module][0],
        "desde": since,
        "hasta": until,
        "moneda": company.moneda if company else "PEN",
        "nota": note,
        "indicadores": metrics,
        "distribucion": groups,
        "distribucion_titulo": group_title,
        "distribucion_tipo": "moneda" if monetary else "numero",
        "serie": [{"fecha": d, "valor": series[d]} for d in dates] if series else [],
        "serie_tipo": "moneda" if monetary else "numero",
    }
