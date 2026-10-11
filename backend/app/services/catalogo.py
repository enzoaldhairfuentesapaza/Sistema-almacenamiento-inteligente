import math
from datetime import date

from fastapi import HTTPException

from app.core.security import permissions
from app.models import Category, Product, ProductType
from app.services.common import row_out


def validate_product(db, data, product_id=None):
    if data.categoria_id and not db.get(Category, data.categoria_id):
        raise HTTPException(422, "Categoría inexistente")
    if data.producto_padre_id:
        parent = db.get(Product, data.producto_padre_id)
        if not parent or parent.producto_padre_id or parent.id == product_id:
            raise HTTPException(
                422, "Producto padre inválido: solo se admite un nivel de variantes"
            )
        if data.tipo_id != parent.tipo_id:
            raise HTTPException(422, "La variante debe usar el tipo del producto padre")
    definition = db.get(ProductType, data.tipo_id) if data.tipo_id else None
    if data.tipo_id and not definition:
        raise HTTPException(422, "Tipo inexistente")
    fields = {c["clave"]: c for c in definition.campos} if definition else {}
    if set(data.atributos) - set(fields):
        raise HTTPException(422, "Hay atributos no definidos para este tipo")
    for key, f in fields.items():
        v = data.atributos.get(key)
        if v is None or v == "":
            if f["obligatorio"]:
                raise HTTPException(422, f"Campo obligatorio: {f['etiqueta']}")
            continue
        valid = True
        if f["tipo"] == "texto":
            valid = isinstance(v, str) and len(v) <= 1000
        if f["tipo"] == "numero":
            valid = isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
        if f["tipo"] == "booleano":
            valid = isinstance(v, bool)
        if f["tipo"] == "seleccion":
            valid = v in f["opciones"]
        if f["tipo"] == "fecha":
            try:
                date.fromisoformat(v)
            except (ValueError, TypeError):
                valid = False
        if not valid:
            raise HTTPException(422, f"Valor inválido: {f['etiqueta']}")


def product_out(db, p, user):
    return row_out(p, exclude=() if "costos.ver" in permissions(db, user) else ("costo",))


def save_product(db, data, user, existing=None):
    validate_product(db, data, existing.id if existing else None)
    values = data.model_dump()
    if "costos.ver" not in permissions(db, user):
        if data.costo is not None:
            raise HTTPException(403, "No tienes permiso para gestionar costos")
        values.pop("costo")
    elif values["costo"] is None:
        values.pop("costo")
    p = existing or Product()
    for k, v in values.items():
        setattr(p, k, v)
    if not existing:
        db.add(p)
    return p
