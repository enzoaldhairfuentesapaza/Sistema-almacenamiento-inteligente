from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.security import permissions
from app.db.base import Base
from app.models import (
    Almacen,
    Contact,
    Movement,
    Payment,
    Product,
    Purchase,
    PurchaseLine,
    Sale,
    SaleLine,
    Stock,
    User,
)
from app.schemas.sistema import ProductInput
from app.services.analytics import local_date, summary
from app.services.catalogo import validate_product
from app.services.demo import seed_repuestos
from app.services.forecast import forecast


def test_demo_reconciles_stock_money_scope_and_forecast(tmp_path):
    engine = create_engine("sqlite:///" + str(tmp_path / "demo.sqlite3"))
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        stats = seed_repuestos(db, "Synthetic-test-password-123")
        db.commit()
        assert stats["productos"] == 80 and stats["usuarios"] == 6
        assert len(list(db.scalars(select(Contact)))) == 50
        assert stats["ventas"] > 1000 and stats["compras"] > 50
        assert len(list(db.scalars(select(Stock)))) == 240
        owner = db.scalar(select(User).where(User.propietario.is_(True)))
        for p in db.scalars(select(Product)):
            data = ProductInput(**{key: getattr(p, key) for key in ProductInput.model_fields})
            validate_product(db, data, p.id)
        # Reconcile every ledger balance in chronological order, including cancellations/transfers.
        running = defaultdict(lambda: Decimal(0))
        transfers = defaultdict(lambda: Decimal(0))
        for m in db.scalars(select(Movement).order_by(Movement.fecha, Movement.id)):
            key = (m.producto_id, m.almacen_id)
            running[key] += m.cantidad
            assert running[key] == m.saldo and m.saldo >= 0
            if m.tipo.startswith("transferencia_"):
                transfers[m.referencia] += m.cantidad
        assert transfers and all(v == 0 for v in transfers.values())
        for stock in db.scalars(select(Stock)):
            assert running[(stock.producto_id, stock.almacen_id)] == stock.cantidad
        lines = defaultdict(lambda: Decimal(0))
        payments = defaultdict(lambda: Decimal(0))
        for line in db.scalars(select(SaleLine)):
            lines[line.venta_id] += line.importe
        for pay in db.scalars(select(Payment)):
            payments[pay.venta_id] += pay.monto
        for sale in db.scalars(select(Sale)):
            assert sale.subtotal == lines[sale.id]
            assert sale.total == sale.subtotal + sale.impuesto
            assert sale.pagado == payments[sale.id] and sale.pagado <= sale.total
            if sale.estado == "anulada":
                assert sale.pagado == 0
        receipts = defaultdict(lambda: Decimal(0))
        for line in db.scalars(select(PurchaseLine)):
            receipts[line.compra_id] += line.cantidad * line.costo
        for receipt in db.scalars(select(Purchase)):
            assert receipt.total == receipts[receipt.id]
        seller = db.scalar(select(User).where(User.email.like("ventas@%")))
        stores = list(db.scalars(select(Almacen).where(Almacen.sede_id.in_(seller.sedes))))
        assert len(stores) == 1 and stores[0].nombre == "Tienda Juliaca"
        assert "costos.ver" not in permissions(db, seller)
        assert summary(db, owner)["alertas"]
        result = forecast(db, owner, 14)
        assert result["dias_historial"] >= 180 and len(result["predicciones"]) == 14
        assert {m["modelo"] for m in result["metricas"]} == {"semanal", "ridge_calendario"}
        with pytest.raises(ValueError, match="base vacía"):
            seed_repuestos(db, "Synthetic-test-password-123")
        db.rollback()
    engine.dispose()


def test_local_dates_respect_aware_offset():
    moment = datetime(2026, 10, 10, 0, 30, tzinfo=timezone(timedelta(hours=2)))
    assert local_date(moment, ZoneInfo("America/Lima")).isoformat() == "2026-10-09"
