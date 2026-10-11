"""Deterministic, entirely fictional business fixtures for an isolated development database."""

import random
from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.roles import ROLE_CODES
from app.core.security import audit, password_hash
from app.models import (
    Almacen,
    Audit,
    Category,
    Contact,
    Empresa,
    Movement,
    Payment,
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

D = Decimal


def amount(value):
    return D(value).quantize(D(".01"), rounding=ROUND_HALF_UP)


def catalog():
    """80 SKUs; each tuple has family, name, price, attributes, brand."""
    rows = []
    for i in range(10):
        rows.append(
            (
                "Repuestos",
                f"Filtro de aceite modelo DR-{i + 1:02d}",
                28 + i * 3,
                {"compatibilidad": f"Motor Demo {1 + i % 3}.6", "medida_mm": 65 + i * 2},
                "DemoParts",
            )
        )
    for i in range(8):
        rows.append(
            (
                "Repuestos",
                f"Correa de transmisión {700 + i * 50} mm",
                32 + i * 4,
                {"compatibilidad": f"Motor Demo {1 + i % 3}.6", "medida_mm": 700 + i * 50},
                "DemoParts",
            )
        )
    for i in range(10):
        rows.append(
            (
                "Repuestos",
                f"Rodamiento sellado 62{i:02d}",
                18 + i * 5,
                {"compatibilidad": "Uso industrial Demo", "medida_mm": 20 + i * 2},
                "Torque Demo",
            )
        )
    for i in range(7):
        rows.append(
            (
                "Repuestos",
                f"Pastillas de freno serie DR-{i + 1:02d}",
                65 + i * 9,
                {"compatibilidad": f"Vehículo Demo {i + 1}", "medida_mm": 100 + i * 5},
                "DemoParts",
            )
        )
    for i in range(5):
        rows.append(
            (
                "Herramientas",
                f"Taladro percutor {450 + i * 100} W",
                180 + i * 45,
                {"potencia_w": 450 + i * 100, "medida": "Mandril 13 mm"},
                "DemoTool",
            )
        )
    for i in range(8):
        rows.append(
            (
                "Herramientas",
                f"Llave combinada {8 + i * 2} mm",
                12 + i * 4,
                {"potencia_w": None, "medida": f"{8 + i * 2} mm"},
                "DemoTool",
            )
        )
    for i in range(4):
        rows.append(
            (
                "Herramientas",
                f"Martillo de taller {250 + i * 250} g",
                22 + i * 8,
                {"potencia_w": None, "medida": f"{250 + i * 250} g"},
                "DemoTool",
            )
        )
    for i in range(4):
        rows.append(
            (
                "Herramientas",
                f"Alicate universal {6 + i} pulgadas",
                25 + i * 7,
                {"potencia_w": None, "medida": f"{6 + i} pulgadas"},
                "DemoTool",
            )
        )
    for i in range(4):
        rows.append(
            (
                "Herramientas",
                f"Juego de dados {12 + i * 6} piezas",
                48 + i * 18,
                {"potencia_w": None, "medida": f"{12 + i * 6} piezas"},
                "Torque Demo",
            )
        )
    for i in range(5):
        rows.append(
            (
                "Materiales",
                f"Cable eléctrico {1.5 + i * 0.5:g} mm²",
                3 + i,
                {"longitud_m": 1, "diametro_mm": 1.5 + i * 0.5, "color": "Negro"},
                "DemoCable",
            )
        )
    for i in range(5):
        rows.append(
            (
                "Materiales",
                f"Caja de tornillos M{4 + i * 2}",
                14 + i * 6,
                {"longitud_m": None, "diametro_mm": 4 + i * 2, "color": "Acero"},
                "Torque Demo",
            )
        )
    for color in ["Amarillo", "Negro", "Blanco", "Azul", "Rojo"]:
        for litres in [1, 4]:
            rows.append(
                (
                    "Pinturas",
                    f"Pintura industrial {color.lower()} {litres} L",
                    24 * litres,
                    {"color": color, "presentacion_l": litres},
                    "DemoColor",
                )
            )
    assert len(rows) == 80
    return rows


def seed_repuestos(db, password, today=None):
    """Atomic insert only. Caller owns transaction; no deletion, no credentials in output."""
    if not 12 <= len(password) <= 200:
        raise ValueError("La contraseña debe tener entre 12 y 200 caracteres")
    # Even an existing organization/bootstrap blocks this full fixture; never overlay business data.
    for model in (
        Empresa,
        Sede,
        Almacen,
        User,
        Role,
        Product,
        ProductType,
        Category,
        Contact,
        Sale,
        Purchase,
        Movement,
        Stock,
        Payment,
    ):
        if db.scalar(select(model.id).limit(1)) is not None:
            raise ValueError("Demo Repuestos requiere una base vacía; utiliza scripts/demo.ps1")
    zone = ZoneInfo("America/Lima")
    today = today or datetime.now(zone).date()
    current = (
        datetime.now(zone)
        if today == datetime.now(zone).date()
        else datetime.combine(today, time(23, 59), zone)
    )
    include_today = current.hour >= 16
    start = today - timedelta(days=180)
    rng = random.Random(20261010)
    company = Empresa(
        id=1,
        razon_social="Demo Repuestos - Empresa ficticia",
        nombre_comercial="Demo Repuestos",
        moneda="PEN",
        zona_horaria="America/Lima",
    )
    db.add(company)
    db.flush()
    sites = [
        Sede(
            empresa_id=1,
            codigo="AQP",
            nombre="Arequipa",
            direccion="Dirección ficticia de demostración - Arequipa",
        ),
        Sede(
            empresa_id=1,
            codigo="JUL",
            nombre="Juliaca",
            direccion="Dirección ficticia de demostración - Juliaca",
        ),
    ]
    db.add_all(sites)
    db.flush()
    stores = [
        Almacen(sede_id=sites[0].id, codigo="TIENDA", nombre="Tienda Arequipa"),
        Almacen(sede_id=sites[0].id, codigo="CENTRAL", nombre="Almacén central Arequipa"),
        Almacen(sede_id=sites[1].id, codigo="TIENDA", nombre="Tienda Juliaca"),
    ]
    db.add_all(stores)
    db.flush()
    roles = {}
    for title, codes in ROLE_CODES.items():
        role = Role(nombre=title, permisos=list(dict.fromkeys(codes)))
        db.add(role)
        db.flush()
        roles[title] = role
    digest = password_hash.hash(password)
    users = []
    for email, name, role, scope in [
        ("propietario", "Propietario Demo", None, []),
        ("admin", "Administrador Demo", "Administrador", [s.id for s in sites]),
        ("almacen", "Almacenero Arequipa", "Almacenero", [sites[0].id]),
        ("ventas", "Vendedor Juliaca", "Vendedor", [sites[1].id]),
        ("analista", "Analista Demo", "Analista", [s.id for s in sites]),
        ("lector", "Lector Arequipa", "Lector", [sites[0].id]),
    ]:
        user = User(
            nombre=name,
            email=email + "@demo-repuestos.example.com",
            password_hash=digest,
            propietario=role is None,
            roles=[roles[role].id] if role else [],
            sedes=scope,
        )
        db.add(user)
        users.append(user)
    db.flush()
    owner = users[0]
    defs = {
        "Repuestos": [
            {
                "clave": "compatibilidad",
                "etiqueta": "Compatibilidad",
                "tipo": "texto",
                "obligatorio": True,
                "opciones": [],
            },
            {
                "clave": "medida_mm",
                "etiqueta": "Medida (mm)",
                "tipo": "numero",
                "obligatorio": False,
                "opciones": [],
            },
        ],
        "Herramientas": [
            {
                "clave": "potencia_w",
                "etiqueta": "Potencia (W)",
                "tipo": "numero",
                "obligatorio": False,
                "opciones": [],
            },
            {
                "clave": "medida",
                "etiqueta": "Medida o presentación",
                "tipo": "texto",
                "obligatorio": True,
                "opciones": [],
            },
        ],
        "Materiales": [
            {
                "clave": "longitud_m",
                "etiqueta": "Longitud (m)",
                "tipo": "numero",
                "obligatorio": False,
                "opciones": [],
            },
            {
                "clave": "diametro_mm",
                "etiqueta": "Diámetro (mm)",
                "tipo": "numero",
                "obligatorio": False,
                "opciones": [],
            },
            {
                "clave": "color",
                "etiqueta": "Color",
                "tipo": "texto",
                "obligatorio": False,
                "opciones": [],
            },
        ],
        "Pinturas": [
            {
                "clave": "color",
                "etiqueta": "Color",
                "tipo": "seleccion",
                "obligatorio": True,
                "opciones": ["Amarillo", "Negro", "Blanco", "Azul", "Rojo"],
            },
            {
                "clave": "presentacion_l",
                "etiqueta": "Presentación (litros)",
                "tipo": "numero",
                "obligatorio": True,
                "opciones": [],
            },
        ],
    }
    types = {}
    cats = {}
    for title, fields in defs.items():
        typ = ProductType(nombre=title, campos=fields)
        cat = Category(nombre=title)
        db.add_all([typ, cat])
        db.flush()
        types[title] = typ
        cats[title] = cat
    products = []
    for i, (family, name, price, attrs, brand) in enumerate(catalog()):
        p = Product(
            sku=f"DR-{i + 1:03d}",
            nombre=name,
            descripcion="Artículo ficticio para pruebas de Demo Repuestos. Importes referenciales inventados.",
            marca=brand,
            unidad="metro" if "Cable" in name else "unidad",
            tipo_id=types[family].id,
            categoria_id=cats[family].id,
            atributos=attrs,
            precio=amount(price),
            costo=amount(D(price) * D(".62")),
            stock_minimo=D(5),
        )
        if family == "Pinturas" and i > 70:
            p.producto_padre_id = products[70].id
        db.add(p)
        db.flush()
        products.append(p)
    clients = []
    providers = []
    for kind, count, target in [("cliente", 40, clients), ("proveedor", 10, providers)]:
        for i in range(count):
            c = Contact(
                tipo=kind,
                nombre=f"{'Taller' if kind == 'cliente' else 'Distribuidor'} Demo {i + 1:02d}",
                documento=f"DEMO-{'C' if kind == 'cliente' else 'P'}{i + 1:03d}",
                telefono="FICTICIO",
                email=f"{kind}{i + 1:02d}@example.com",
            )
            db.add(c)
            target.append(c)
    db.flush()
    stock = {}
    balances = defaultdict(lambda: D(0))
    movement_count = 0

    def stamp(day, hour=10, minute=0):
        return datetime.combine(day, time(hour, minute), zone).astimezone(timezone.utc)

    def move(product, store, quantity, kind, reason, ref, at):
        nonlocal movement_count
        key = (product.id, store.id)
        new = balances[key] + quantity
        if new < 0:
            raise ValueError("Stock negativo en el generador de demostración")
        balances[key] = new
        if key not in stock:
            stock[key] = Stock(producto_id=product.id, almacen_id=store.id, cantidad=new)
            db.add(stock[key])
        else:
            stock[key].cantidad = new
        db.add(
            Movement(
                producto_id=product.id,
                almacen_id=store.id,
                cantidad=quantity,
                saldo=new,
                tipo=kind,
                motivo=reason,
                referencia=ref,
                usuario_id=owner.id,
                fecha=at,
            )
        )
        movement_count += 1

    for store in stores:
        for p in products:
            move(
                p,
                store,
                D(100 if store == stores[1] else 40),
                "entrada",
                "Saldo inicial ficticio",
                "DEMO-APERTURA",
                stamp(start, 8),
            )
    purchase_count = 0
    sale_count = 0
    payment_count = 0

    def purchase(day, store, items, at=None):
        nonlocal purchase_count
        purchase_count += 1
        at = at or stamp(day, 9)
        p = Purchase(
            request_id=f"demo-compra-{purchase_count:05d}",
            almacen_id=store.id,
            proveedor_id=rng.choice(providers).id,
            usuario_id=owner.id,
            total=sum((amount(q * product.costo) for product, q in items), D(0)),
            referencia=f"DEMO-RECEPCION-{purchase_count:05d}",
            fecha=at,
        )
        db.add(p)
        db.flush()
        for product, qty in items:
            db.add(
                PurchaseLine(
                    compra_id=p.id, producto_id=product.id, cantidad=qty, costo=product.costo
                )
            )
            move(product, store, qty, "compra", "Recepción ficticia", f"CO-{p.id}", at)

    for day_index in range(181 if include_today else 180):
        day = start + timedelta(days=day_index)
        if day_index and day_index % 7 == 0:
            purchase(day, stores[1], [(p, D(25)) for p in rng.sample(products, 6)])
            for product in rng.sample(products[:35], 3):
                if balances[(product.id, stores[1].id)] < 10:
                    purchase(day, stores[1], [(product, D(30))])
                ref = f"TR-DEMO-{day_index}-{product.id}"
                move(
                    product,
                    stores[1],
                    D(-5),
                    "transferencia_salida",
                    "Envío ficticio a Juliaca",
                    ref,
                    stamp(day, 9, 20),
                )
                move(
                    product,
                    stores[2],
                    D(5),
                    "transferencia_entrada",
                    "Recepción ficticia desde central",
                    ref,
                    stamp(day, 9, 20),
                )
        for store_index, store in enumerate([stores[0], stores[2]]):
            # Explicit stable, growing and Saturday-heavy unit series.
            signals = [
                (products[0], D(2)),
                (products[1], D(1 + day_index // 60)),
                (products[2], D(7 if day.weekday() == 5 else 2)),
            ]
            orders = [signals]
            for _ in range(rng.randint(1, 3) + (2 if day.weekday() == 5 else 0)):
                orders.append(
                    [(p, D(rng.randint(1, 3))) for p in rng.sample(products, rng.randint(1, 3))]
                )
            for order_index, items in enumerate(orders):
                at = stamp(day, 10 + order_index, store_index * 10)
                for product, qty in items:
                    if balances[(product.id, store.id)] < qty:
                        purchase(day, store, [(product, D(35))], at - timedelta(minutes=2))
                sale_count += 1
                canceled = sale_count % 37 == 0
                subtotal = sum((amount(q * product.precio) for product, q in items), D(0))
                tax = amount(subtotal * D(".18"))
                total = subtotal + tax
                sale = Sale(
                    request_id=f"demo-venta-{sale_count:05d}",
                    almacen_id=store.id,
                    cliente_id=rng.choice(clients).id,
                    usuario_id=users[3].id if store == stores[2] else users[1].id,
                    subtotal=subtotal,
                    impuesto=tax,
                    total=total,
                    pagado=D(0),
                    moneda="PEN",
                    estado="anulada" if canceled else "confirmada",
                    observacion="Venta ficticia para pruebas"
                    + ("; anulación sin cobro" if canceled else ""),
                    fecha=at,
                )
                db.add(sale)
                db.flush()
                for product, qty in items:
                    db.add(
                        SaleLine(
                            venta_id=sale.id,
                            producto_id=product.id,
                            sku=product.sku,
                            nombre=product.nombre,
                            cantidad=qty,
                            precio=product.precio,
                            costo=product.costo,
                            descuento=D(0),
                            importe=amount(qty * product.precio),
                        )
                    )
                    move(
                        product,
                        store,
                        -qty,
                        "venta",
                        "Venta ficticia confirmada",
                        f"VE-{sale.id}",
                        at,
                    )
                    if canceled:
                        move(
                            product,
                            store,
                            qty,
                            "anulacion",
                            "Anulación ficticia sin cobro",
                            f"VE-{sale.id}",
                            at + timedelta(minutes=1),
                        )
                if not canceled and sale_count % 10 != 0:
                    paid = amount(total * D(".5")) if sale_count % 7 == 0 else total
                    methods = ["efectivo", "tarjeta", "transferencia", "yape", "plin"]
                    method = methods[sale_count % 5]
                    payment_count += 1
                    db.add(
                        Payment(
                            request_id=f"demo-pago-{payment_count:05d}",
                            venta_id=sale.id,
                            monto=paid,
                            metodo=method,
                            referencia=f"DEMO-PAGO-{payment_count:05d}"
                            if method != "efectivo"
                            else "",
                            usuario_id=sale.usuario_id,
                            fecha=at + timedelta(minutes=2),
                        )
                    )
                    sale.pagado = paid
                db.add(
                    Audit(
                        usuario_id=owner.id,
                        accion="demo_anular" if canceled else "demo_venta",
                        entidad="venta",
                        entidad_id=sale.id,
                        detalle="Operación ficticia",
                        fecha=at,
                    )
                )
                db.flush()
    # Present-day edge cases: an empty stock and low stocks, all backed by ledger adjustments.
    for p, store, target in [
        (products[-1], stores[0], D(0)),
        (products[-2], stores[2], D(2)),
        (products[20], stores[0], D(3)),
    ]:
        qty = target - balances[(p.id, store.id)]
        if qty:
            move(
                p,
                store,
                qty,
                "ajuste",
                "Escenario ficticio de reposición",
                "DEMO-AJUSTE",
                min(stamp(today, 16), current.astimezone(timezone.utc)),
            )
    stats = {
        "empresa": "Demo Repuestos",
        "productos": len(products),
        "clientes": len(clients),
        "proveedores": len(providers),
        "sedes": 2,
        "almacenes": 3,
        "usuarios": 6,
        "ventas": sale_count,
        "compras": purchase_count,
        "pagos": payment_count,
        "movimientos": movement_count,
        "inicio": start.isoformat(),
        "fin": today.isoformat(),
        "semilla": 20261010,
    }
    audit(
        db,
        owner,
        "demo_repuestos",
        "instalacion",
        detail="Datos íntegramente ficticios; 180 días completos más día actual",
    )
    db.flush()
    return stats
