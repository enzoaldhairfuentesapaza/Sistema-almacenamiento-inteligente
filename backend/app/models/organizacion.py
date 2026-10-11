from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Empresa(Base):
    __tablename__ = "empresa"
    __table_args__ = (CheckConstraint("id = 1", name="ck_empresa_unica"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False, default=1)
    razon_social: Mapped[str] = mapped_column(String(200))
    nombre_comercial: Mapped[str] = mapped_column(String(200))
    ruc: Mapped[str | None] = mapped_column(String(11))
    moneda: Mapped[str] = mapped_column(String(3), server_default=text("'PEN'"))
    zona_horaria: Mapped[str] = mapped_column(String(100), server_default=text("'America/Lima'"))


class Sede(Base):
    __tablename__ = "sedes"
    __table_args__ = (UniqueConstraint("codigo", name="uq_sedes_codigo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    empresa_id: Mapped[int] = mapped_column(ForeignKey("empresa.id", ondelete="RESTRICT"))
    codigo: Mapped[str] = mapped_column(String(30))
    nombre: Mapped[str] = mapped_column(String(150))
    direccion: Mapped[str | None] = mapped_column(String(300))
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Almacen(Base):
    __tablename__ = "almacenes"
    __table_args__ = (UniqueConstraint("sede_id", "codigo", name="uq_almacenes_sede_codigo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    sede_id: Mapped[int] = mapped_column(ForeignKey("sedes.id", ondelete="RESTRICT"))
    codigo: Mapped[str] = mapped_column(String(30))
    nombre: Mapped[str] = mapped_column(String(150))
    activo: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
