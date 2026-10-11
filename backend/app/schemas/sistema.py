from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator


class Input(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


PasswordText = Annotated[str, StringConstraints(strip_whitespace=False)]


class Login(Input):
    email: EmailStr
    password: PasswordText = Field(min_length=1, max_length=200)


class ChangePassword(Input):
    actual: PasswordText
    nueva: PasswordText = Field(min_length=12, max_length=200)


class RoleInput(Input):
    nombre: str = Field(min_length=1, max_length=80)
    permisos: list[str]


class UserInput(Input):
    nombre: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: PasswordText | None = Field(default=None, min_length=12, max_length=200)
    roles: list[int] = Field(default_factory=list, max_length=30)
    sedes: list[int] = Field(default_factory=list, max_length=100)
    activo: bool = True


class FieldDef(Input):
    clave: str = Field(pattern=r"^[a-z][a-z0-9_]{0,39}$")
    etiqueta: str = Field(min_length=1, max_length=80)
    tipo: Literal["texto", "numero", "fecha", "booleano", "seleccion"]
    obligatorio: bool = False
    opciones: list[str] = Field(default_factory=list, max_length=100)


class TypeInput(Input):
    nombre: str = Field(min_length=1, max_length=100)
    campos: list[FieldDef] = Field(default_factory=list, max_length=40)

    @field_validator("campos")
    @classmethod
    def fields_unique(cls, fields):
        if len({f.clave for f in fields}) != len(fields):
            raise ValueError("Claves de campo duplicadas")
        if any(f.tipo == "seleccion" and not f.opciones for f in fields):
            raise ValueError("Selección requiere opciones")
        return fields


class CategoryInput(Input):
    nombre: str = Field(min_length=1, max_length=100)
    padre_id: int | None = Field(default=None, gt=0)


class ProductInput(Input):
    sku: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")
    nombre: str = Field(min_length=1, max_length=200)
    descripcion: str = Field(default="", max_length=2000)
    marca: str = Field(default="", max_length=100)
    unidad: str = Field(default="unidad", min_length=1, max_length=30)
    tipo_id: int | None = Field(default=None, gt=0)
    categoria_id: int | None = Field(default=None, gt=0)
    producto_padre_id: int | None = Field(default=None, gt=0)
    atributos: dict = Field(default_factory=dict)
    precio: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    costo: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=3)
    activo: bool = True


class StatusInput(Input):
    activo: bool


class Reason(Input):
    motivo: str = Field(min_length=3, max_length=300)


class MoveInput(Reason):
    producto_id: int = Field(gt=0)
    almacen_id: int = Field(gt=0)
    tipo: Literal["entrada", "salida", "ajuste", "transferencia"]
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    destino_id: int | None = Field(default=None, gt=0)
    direccion_ajuste: Literal["sumar", "restar"] = "sumar"
    referencia: str = Field(default="", max_length=100)


class ContactInput(Input):
    tipo: Literal["cliente", "proveedor"]
    nombre: str = Field(min_length=1, max_length=200)
    documento: str = Field(default="", max_length=30)
    telefono: str = Field(default="", max_length=40)
    email: str = Field(default="", max_length=200)
    activo: bool = True


class SaleItem(Input):
    producto_id: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    precio: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    descuento: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)


class SaleInput(Input):
    request_id: str = Field(min_length=8, max_length=80)
    almacen_id: int = Field(gt=0)
    cliente_id: int | None = Field(default=None, gt=0)
    items: list[SaleItem] = Field(min_length=1, max_length=100)
    tasa_impuesto: Decimal = Field(default=Decimal("0"), ge=0, le=1, max_digits=4, decimal_places=3)
    observacion: str = Field(default="", max_length=300)


class PaymentInput(Input):
    request_id: str = Field(min_length=8, max_length=80)
    monto: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    metodo: Literal["efectivo", "tarjeta", "transferencia", "yape", "plin"]
    referencia: str = Field(default="", max_length=100)


class PurchaseItem(Input):
    producto_id: int = Field(gt=0)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    costo: Decimal = Field(ge=0, max_digits=14, decimal_places=2)


class PurchaseInput(Input):
    request_id: str = Field(min_length=8, max_length=80)
    almacen_id: int = Field(gt=0)
    proveedor_id: int = Field(gt=0)
    referencia: str = Field(default="", max_length=100)
    items: list[PurchaseItem] = Field(min_length=1, max_length=100)


class AssistantInput(Input):
    pregunta: str = Field(min_length=3, max_length=1000)


class ImportInput(Input):
    filas: list[ProductInput] = Field(min_length=1, max_length=1000)
