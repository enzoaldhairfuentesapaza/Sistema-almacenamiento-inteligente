from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def now():
    return datetime.now(timezone.utc)


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(80), unique=True)
    permisos: Mapped[list] = mapped_column(JSON, default=list)


class User(Base):
    __tablename__ = "usuarios"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(200), unique=True)
    password_hash: Mapped[str] = mapped_column(String(500))
    propietario: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    roles: Mapped[list] = mapped_column(JSON, default=list)
    sedes: Mapped[list] = mapped_column(JSON, default=list)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuthSession(Base):
    __tablename__ = "sesiones"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    csrf: Mapped[str] = mapped_column(String(100))
    expira: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Audit(Base):
    __tablename__ = "auditoria"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    accion: Mapped[str] = mapped_column(String(100))
    entidad: Mapped[str] = mapped_column(String(100))
    entidad_id: Mapped[int | None] = mapped_column(Integer)
    detalle: Mapped[str] = mapped_column(Text, default="")
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProductType(Base):
    __tablename__ = "tipos_producto"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    campos: Mapped[list] = mapped_column(JSON, default=list)


class Category(Base):
    __tablename__ = "categorias"
    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    padre_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"))


class Product(Base):
    __tablename__ = "productos"
    __table_args__ = (
        CheckConstraint(
            "precio >= 0 AND costo >= 0 AND stock_minimo >= 0", name="ck_producto_importes"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(80), unique=True)
    nombre: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str] = mapped_column(Text, default="")
    imagen: Mapped[str | None] = mapped_column(String(80))
    marca: Mapped[str] = mapped_column(String(100), default="")
    unidad: Mapped[str] = mapped_column(String(30), default="unidad")
    tipo_id: Mapped[int | None] = mapped_column(ForeignKey("tipos_producto.id"))
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"))
    producto_padre_id: Mapped[int | None] = mapped_column(ForeignKey("productos.id"))
    atributos: Mapped[dict] = mapped_column(JSON, default=dict)
    precio: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    costo: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Stock(Base):
    __tablename__ = "existencias"
    __table_args__ = (
        UniqueConstraint("producto_id", "almacen_id", name="uq_existencia"),
        CheckConstraint("cantidad >= 0", name="ck_stock_no_negativo"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=0)


class Movement(Base):
    __tablename__ = "movimientos"
    __table_args__ = (
        Index("ix_movimientos_almacen_producto_fecha", "almacen_id", "producto_id", "fecha"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    saldo: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    tipo: Mapped[str] = mapped_column(String(30))
    motivo: Mapped[str] = mapped_column(String(300))
    referencia: Mapped[str] = mapped_column(String(100), default="")
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Contact(Base):
    __tablename__ = "contactos"
    id: Mapped[int] = mapped_column(primary_key=True)
    tipo: Mapped[str] = mapped_column(String(20))
    nombre: Mapped[str] = mapped_column(String(200))
    documento: Mapped[str] = mapped_column(String(30), default="")
    telefono: Mapped[str] = mapped_column(String(40), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Sale(Base):
    __tablename__ = "ventas"
    __table_args__ = (Index("ix_ventas_almacen_fecha", "almacen_id", "fecha"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[str] = mapped_column(String(80), unique=True)
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("contactos.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    impuesto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    pagado: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    moneda: Mapped[str] = mapped_column(String(3))
    estado: Mapped[str] = mapped_column(String(20), default="confirmada")
    observacion: Mapped[str] = mapped_column(String(300), default="")
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SaleLine(Base):
    __tablename__ = "venta_detalles"
    __table_args__ = (Index("ix_venta_detalles_venta", "venta_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    sku: Mapped[str] = mapped_column(String(80))
    nombre: Mapped[str] = mapped_column(String(200))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    precio: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    costo: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    descuento: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    importe: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class Payment(Base):
    __tablename__ = "pagos"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[str] = mapped_column(String(80), unique=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id"))
    monto: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    metodo: Mapped[str] = mapped_column(String(30))
    referencia: Mapped[str] = mapped_column(String(100), default="")
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Purchase(Base):
    __tablename__ = "compras"
    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[str] = mapped_column(String(80), unique=True)
    almacen_id: Mapped[int] = mapped_column(ForeignKey("almacenes.id"))
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("contactos.id"))
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    referencia: Mapped[str] = mapped_column(String(100))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class PurchaseLine(Base):
    __tablename__ = "compra_detalles"
    id: Mapped[int] = mapped_column(primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id"))
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"))
    cantidad: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    costo: Mapped[Decimal] = mapped_column(Numeric(14, 2))


class ImportJob(Base):
    __tablename__ = "importaciones"
    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    filas: Mapped[int] = mapped_column(Integer)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
