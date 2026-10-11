from decimal import ROUND_HALF_UP, Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.security import audit, permissions, require, scoped, warehouse
from app.db.session import get_db
from app.models import (
    Almacen,
    Contact,
    Empresa,
    Payment,
    Product,
    Purchase,
    PurchaseLine,
    Sale,
    SaleLine,
)
from app.schemas.sistema import ContactInput, PaymentInput, PurchaseInput, Reason, SaleInput
from app.services.common import commit, row_out
from app.services.inventario import delta, lock_products

router = APIRouter(tags=["Operación comercial"])


def money(n):
    return Decimal(n).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)


def valid_contact(db, id, kind):
    r = db.get(Contact, id)
    if not r or r.tipo != kind or not r.activo:
        raise HTTPException(422, f"{kind.capitalize()} inexistente o inactivo")
    return r


@router.get("/contactos")
def contacts(
    tipo: str | None = None,
    q: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("contactos.ver")),
    db: Session = Depends(get_db),
):
    query = select(Contact).order_by(Contact.nombre)
    if tipo:
        query = query.where(Contact.tipo == tipo)
    if q:
        query = query.where(
            or_(
                Contact.nombre.ilike(f"%{q}%"),
                Contact.documento.ilike(f"%{q}%"),
                Contact.email.ilike(f"%{q}%"),
            )
        )
    return [row_out(r) for r in db.scalars(query.offset(offset).limit(limit))]


@router.post("/contactos", status_code=201)
def create_contact(
    data: ContactInput, user=Depends(require("contactos.editar")), db: Session = Depends(get_db)
):
    r = Contact(**data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "contacto", r.id)
    commit(db)
    return row_out(r)


@router.put("/contactos/{id}")
def edit_contact(
    id: int,
    data: ContactInput,
    user=Depends(require("contactos.editar")),
    db: Session = Depends(get_db),
):
    r = db.get(Contact, id)
    if not r:
        raise HTTPException(404, "Contacto inexistente")
    if data.tipo != r.tipo:
        raise HTTPException(409, "No cambies el tipo de un contacto registrado")
    for k, v in data.model_dump().items():
        setattr(r, k, v)
    audit(db, user, "editar", "contacto", id)
    commit(db)
    return row_out(r)


def sale_out(db, s, user, details=False):
    out = row_out(s, ("request_id",))
    out["numero"] = f"VE-{s.id:06d}"
    out["almacen"] = db.get(Almacen, s.almacen_id).nombre
    if details:
        financial = "costos.ver" in permissions(db, user)
        out["items"] = [
            row_out(r, () if financial else ("costo",))
            for r in db.scalars(select(SaleLine).where(SaleLine.venta_id == s.id))
        ]
        out["pagos"] = [
            row_out(r, ("request_id",))
            for r in db.scalars(select(Payment).where(Payment.venta_id == s.id))
        ]
    return out


@router.get("/ventas")
def sales(
    q: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("ventas.ver")),
    db: Session = Depends(get_db),
):
    query = scoped(
        select(Sale)
        .join(Almacen, Almacen.id == Sale.almacen_id)
        .outerjoin(Contact, Contact.id == Sale.cliente_id),
        Sale.almacen_id,
        user,
    )
    if q:
        number = q.upper().removeprefix("VE-").strip()
        if number.isascii() and number.isdecimal():
            query = query.where(Sale.id == (int(number) if int(number) < 2147483648 else -1))
        else:
            query = query.where(or_(Almacen.nombre.ilike(f"%{q}%"), Contact.nombre.ilike(f"%{q}%")))
    return [
        sale_out(db, s, user)
        for s in db.scalars(query.order_by(Sale.id.desc()).offset(offset).limit(limit))
    ]


@router.get("/ventas/{id}")
def get_sale(id: int, user=Depends(require("ventas.ver")), db: Session = Depends(get_db)):
    s = db.get(Sale, id)
    if not s:
        raise HTTPException(404, "Venta inexistente")
    warehouse(db, user, s.almacen_id, False)
    return sale_out(db, s, user, True)


@router.post("/ventas", status_code=201)
def create_sale(
    data: SaleInput, user=Depends(require("ventas.crear")), db: Session = Depends(get_db)
):
    warehouse(db, user, data.almacen_id)
    existing = db.scalar(select(Sale).where(Sale.request_id == data.request_id))
    if existing:
        warehouse(db, user, existing.almacen_id, False)
        if existing.usuario_id != user.id:
            raise HTTPException(409, "Identificador de operación usado")
        return sale_out(db, existing, user, True)
    company = db.get(Empresa, 1)
    if not company:
        raise HTTPException(409, "Configura la empresa")
    if data.cliente_id:
        valid_contact(db, data.cliente_id, "cliente")
    ids = [i.producto_id for i in data.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Agrupa las cantidades del mismo producto en una fila")
    products = lock_products(db, ids)
    lines = []
    subtotal = Decimal(0)
    for item in data.items:
        p = products[item.producto_id]
        price = p.precio if item.precio is None else item.precio
        amount = money(item.cantidad * price - item.descuento)
        if amount < 0:
            raise HTTPException(422, "El descuento excede el importe de la fila")
        lines.append(
            SaleLine(
                producto_id=p.id,
                sku=p.sku,
                nombre=p.nombre,
                cantidad=item.cantidad,
                precio=price,
                costo=p.costo,
                descuento=item.descuento,
                importe=amount,
            )
        )
        subtotal += amount
    tax = money(subtotal * data.tasa_impuesto)
    if subtotal + tax >= Decimal("1000000000000"):
        raise HTTPException(422, "Total fuera de rango")
    s = Sale(
        request_id=data.request_id,
        almacen_id=data.almacen_id,
        cliente_id=data.cliente_id,
        usuario_id=user.id,
        subtotal=subtotal,
        impuesto=tax,
        total=subtotal + tax,
        moneda=company.moneda,
        observacion=data.observacion,
    )
    db.add(s)
    db.flush()
    for line in lines:
        line.venta_id = s.id
        db.add(line)
        delta(
            db,
            user,
            line.producto_id,
            s.almacen_id,
            -line.cantidad,
            "venta",
            "Venta confirmada",
            f"VE-{s.id}",
        )
    audit(db, user, "crear", "venta", s.id)
    commit(db)
    return sale_out(db, s, user, True)


@router.post("/ventas/{id}/pagos", status_code=201)
def pay(
    id: int,
    data: PaymentInput,
    user=Depends(require("pagos.registrar")),
    db: Session = Depends(get_db),
):
    s = db.get(Sale, id, with_for_update=True)
    if not s:
        raise HTTPException(404, "Venta inexistente")
    warehouse(db, user, s.almacen_id, False)
    existing = db.scalar(select(Payment).where(Payment.request_id == data.request_id))
    if existing:
        if existing.venta_id != id or existing.usuario_id != user.id:
            raise HTTPException(409, "Identificador de pago usado")
        return row_out(existing, ("request_id",))
    if s.estado != "confirmada":
        raise HTTPException(409, "Venta anulada")
    if s.pagado + data.monto > s.total:
        raise HTTPException(409, "El cobro excede el saldo pendiente")
    if data.metodo in ("yape", "plin", "transferencia") and not data.referencia:
        raise HTTPException(422, "Indica referencia de pago verificada")
    p = Payment(venta_id=id, usuario_id=user.id, **data.model_dump())
    db.add(p)
    s.pagado += data.monto
    audit(db, user, "pago", "venta", id, str(data.monto))
    commit(db)
    return row_out(p, ("request_id",))


@router.post("/ventas/{id}/anular")
def cancel(
    id: int, data: Reason, user=Depends(require("ventas.anular")), db: Session = Depends(get_db)
):
    s = db.get(Sale, id, with_for_update=True)
    if not s:
        raise HTTPException(404, "Venta inexistente")
    warehouse(db, user, s.almacen_id, False)
    if s.estado == "anulada":
        raise HTTPException(409, "Venta ya anulada")
    lines = db.scalars(select(SaleLine).where(SaleLine.venta_id == id)).all()
    lock_products(db, [r.producto_id for r in lines])
    for r in lines:
        delta(
            db,
            user,
            r.producto_id,
            s.almacen_id,
            r.cantidad,
            "anulacion",
            data.motivo,
            f"VE-{id}",
            allow_inactive=True,
        )
    s.estado = "anulada"
    audit(db, user, "anular", "venta", id, data.motivo)
    commit(db)
    return dict(**sale_out(db, s, user), reembolso_pendiente=s.pagado)


@router.get("/ventas/{id}/comprobante")
def receipt(id: int, user=Depends(require("ventas.ver")), db: Session = Depends(get_db)):
    s = db.get(Sale, id)
    if not s:
        raise HTTPException(404, "Venta inexistente")
    warehouse(db, user, s.almacen_id, False)
    company = db.get(Empresa, 1)
    styles = getSampleStyleSheet()
    output = BytesIO()
    story = []
    for text in [
        company.nombre_comercial if company else "Empresa",
        f"Constancia de venta VE-{id:06d}",
        "DOCUMENTO INTERNO SIN VALIDEZ TRIBUTARIA",
        f"Estado: {s.estado} | Fecha: {s.fecha:%d/%m/%Y}",
        f"Moneda: {s.moneda}",
    ]:
        story.extend([Paragraph(escape(text), styles["Normal"]), Spacer(1, 9)])
    rows = [["SKU / Producto", "Cantidad", "Precio", "Descuento", "Importe"]]
    for r in db.scalars(select(SaleLine).where(SaleLine.venta_id == id)):
        rows.append(
            [
                Paragraph(escape(r.sku + " / " + r.nombre), styles["Normal"]),
                str(r.cantidad),
                str(r.precio),
                str(r.descuento),
                str(r.importe),
            ]
        )
    table = Table(rows, colWidths=[220, 55, 65, 75, 65], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E3EBE8")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.lightgrey),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 15))
    for label, value in [
        ("Subtotal", s.subtotal),
        ("Impuesto", s.impuesto),
        ("Total", s.total),
        ("Cobrado", s.pagado),
    ]:
        story.append(Paragraph(f"{label}: {value} {s.moneda}", styles["Normal"]))
    if s.estado == "anulada" and s.pagado:
        story.append(
            Paragraph(
                "Los cobros registrados requieren conciliación del reembolso.", styles["Normal"]
            )
        )
    SimpleDocTemplate(output).build(story)
    return Response(
        output.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="venta-{id}.pdf"'},
    )


def purchase_out(db, purchase, details=False):
    out = row_out(purchase, ("request_id",))
    out["almacen"] = db.get(Almacen, purchase.almacen_id).nombre
    out["proveedor"] = db.get(Contact, purchase.proveedor_id).nombre
    if details:
        out["items"] = [
            dict(
                **row_out(line),
                sku=product.sku,
                nombre=product.nombre,
                importe=str(money(line.cantidad * line.costo)),
            )
            for line, product in db.execute(
                select(PurchaseLine, Product)
                .join(Product, Product.id == PurchaseLine.producto_id)
                .where(PurchaseLine.compra_id == purchase.id)
                .order_by(PurchaseLine.id)
            )
        ]
    return out


@router.get("/compras/{id}")
def get_purchase(id: int, user=Depends(require("compras.ver")), db: Session = Depends(get_db)):
    if "costos.ver" not in permissions(db, user):
        raise HTTPException(403, "Consultar compras requiere permiso de costos")
    purchase = db.get(Purchase, id)
    if not purchase:
        raise HTTPException(404, "Compra inexistente")
    warehouse(db, user, purchase.almacen_id, False)
    return purchase_out(db, purchase, True)


@router.get("/compras")
def purchases(
    q: str = Query("", max_length=200),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user=Depends(require("compras.ver")),
    db: Session = Depends(get_db),
):
    if "costos.ver" not in permissions(db, user):
        raise HTTPException(403, "Consultar compras requiere permiso de costos")
    query = scoped(
        select(Purchase)
        .join(Almacen, Almacen.id == Purchase.almacen_id)
        .join(Contact, Contact.id == Purchase.proveedor_id),
        Purchase.almacen_id,
        user,
    )
    if q:
        number = q.upper().removeprefix("CO-").strip()
        if number.isascii() and number.isdecimal():
            query = query.where(Purchase.id == (int(number) if int(number) < 2147483648 else -1))
        else:
            query = query.where(
                or_(
                    Almacen.nombre.ilike(f"%{q}%"),
                    Contact.nombre.ilike(f"%{q}%"),
                    Purchase.referencia.ilike(f"%{q}%"),
                )
            )
    return [
        purchase_out(db, p)
        for p in db.scalars(query.order_by(Purchase.id.desc()).offset(offset).limit(limit))
    ]


@router.post("/compras", status_code=201)
def receive_purchase(
    data: PurchaseInput, user=Depends(require("compras.crear")), db: Session = Depends(get_db)
):
    if "costos.ver" not in permissions(db, user):
        raise HTTPException(403, "Recibir compras requiere permiso de costos")
    warehouse(db, user, data.almacen_id)
    valid_contact(db, data.proveedor_id, "proveedor")
    existing = db.scalar(select(Purchase).where(Purchase.request_id == data.request_id))
    if existing:
        warehouse(db, user, existing.almacen_id, False)
        if existing.usuario_id != user.id:
            raise HTTPException(409, "Identificador de operación usado")
        return purchase_out(db, existing, True)
    ids = [i.producto_id for i in data.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(422, "Producto repetido")
    lock_products(db, ids)
    total = sum(money(i.cantidad * i.costo) for i in data.items)
    if total >= Decimal("1000000000000"):
        raise HTTPException(422, "Total fuera de rango")
    p = Purchase(
        request_id=data.request_id,
        almacen_id=data.almacen_id,
        proveedor_id=data.proveedor_id,
        usuario_id=user.id,
        total=total,
        referencia=data.referencia,
    )
    db.add(p)
    db.flush()
    for i in data.items:
        db.add(PurchaseLine(compra_id=p.id, **i.model_dump()))
        delta(
            db,
            user,
            i.producto_id,
            p.almacen_id,
            i.cantidad,
            "compra",
            "Recepción de compra",
            f"CO-{p.id}",
        )
    audit(db, user, "recibir", "compra", p.id)
    commit(db)
    return purchase_out(db, p, True)
