from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import audit, permissions, require, scoped, warehouse
from app.db.session import get_db
from app.models import Category, Movement, Product, ProductType, PurchaseLine, SaleLine, Stock
from app.schemas.sistema import CategoryInput, ProductInput, StatusInput, TypeInput
from app.services.catalogo import product_out, save_product
from app.services.common import commit, row_out
from app.services.imagenes import MAX_BYTES, remove_image, save_image

router = APIRouter(tags=["Catálogo"])


@router.get("/tipos")
def types(user=Depends(require("productos.ver")), db: Session = Depends(get_db)):
    return [row_out(r) for r in db.scalars(select(ProductType).order_by(ProductType.id))]


@router.post("/tipos", status_code=201)
def create_type(
    data: TypeInput, user=Depends(require("productos.editar")), db: Session = Depends(get_db)
):
    r = ProductType(**data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "tipo", r.id)
    commit(db)
    return row_out(r)


@router.put("/tipos/{id}")
def edit_type(
    id: int,
    data: TypeInput,
    user=Depends(require("productos.editar")),
    db: Session = Depends(get_db),
):
    r = db.get(ProductType, id)
    if not r:
        raise HTTPException(404, "Tipo no encontrado")
    if r.campos != data.model_dump()["campos"] and db.scalar(
        select(Product.id).where(Product.tipo_id == id).limit(1)
    ):
        raise HTTPException(409, "Crea un nuevo tipo para cambiar campos de productos existentes")
    r.nombre = data.nombre
    r.campos = data.model_dump()["campos"]
    audit(db, user, "editar", "tipo", id)
    commit(db)
    return row_out(r)


@router.get("/categorias")
def categories(user=Depends(require("productos.ver")), db: Session = Depends(get_db)):
    return [row_out(r) for r in db.scalars(select(Category).order_by(Category.nombre))]


@router.post("/categorias", status_code=201)
def create_category(
    data: CategoryInput, user=Depends(require("productos.editar")), db: Session = Depends(get_db)
):
    if data.padre_id and not db.get(Category, data.padre_id):
        raise HTTPException(422, "Categoría padre inexistente")
    r = Category(**data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "categoria", r.id)
    commit(db)
    return row_out(r)


@router.get("/productos")
def products(
    q: str = Query("", max_length=200),
    tipo_id: int | None = Query(None, gt=0),
    categoria_id: int | None = Query(None, gt=0),
    activo: bool | None = None,
    solo_padres: bool = False,
    marca: str | None = Query(None, max_length=100),
    precio_min: Decimal | None = Query(None, ge=0, le=999999999999),
    precio_max: Decimal | None = Query(None, ge=0, le=999999999999),
    campo: str | None = Query(None, max_length=40),
    valor: str | None = Query(None, max_length=1000),
    atributo_min: float | None = Query(None, allow_inf_nan=False),
    atributo_max: float | None = Query(None, allow_inf_nan=False),
    existencias: Literal["disponible", "bajo", "agotado"] | None = None,
    almacen_id: int | None = Query(None, gt=0),
    orden: Literal["recientes", "nombre", "sku", "precio_asc", "precio_desc"] = "recientes",
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    user=Depends(require("productos.ver")),
    db: Session = Depends(get_db),
):
    query = select(Product)
    if precio_min is not None and precio_max is not None and precio_min > precio_max:
        raise HTTPException(422, "El precio mínimo no puede superar al máximo")
    if precio_min is not None:
        query = query.where(Product.precio >= precio_min)
    if precio_max is not None:
        query = query.where(Product.precio <= precio_max)
    if marca:
        query = query.where(Product.marca.ilike(f"%{marca}%"))
    if campo:
        kind = db.get(ProductType, tipo_id) if tipo_id else None
        definition = next((f for f in kind.campos if f["clave"] == campo), None) if kind else None
        if not definition:
            raise HTTPException(422, "Selecciona un tipo y uno de sus campos definidos")
        if definition["tipo"] != "numero" and (
            atributo_min is not None or atributo_max is not None
        ):
            raise HTTPException(422, "Los límites del campo solo se aplican a atributos numéricos")
        attr = Product.atributos[campo]
        if definition["tipo"] == "numero":
            if (
                atributo_min is not None
                and atributo_max is not None
                and atributo_min > atributo_max
            ):
                raise HTTPException(422, "El mínimo del campo no puede superar al máximo")
            if atributo_min is not None:
                query = query.where(attr.as_float() >= atributo_min)
            if atributo_max is not None:
                query = query.where(attr.as_float() <= atributo_max)
            if valor is not None and valor != "":
                import math

                try:
                    number = float(valor)
                    if not math.isfinite(number):
                        raise ValueError
                except ValueError:
                    raise HTTPException(
                        422, "El valor del campo debe ser un número finito"
                    ) from None
                query = query.where(attr.as_float() == number)
        elif definition["tipo"] == "booleano":
            if valor not in (None, "", "true", "false"):
                raise HTTPException(422, "Selecciona Sí o No para ese campo")
            if valor in ("true", "false"):
                query = query.where(attr.as_boolean() == (valor == "true"))
        elif valor:
            query = query.where(
                attr.as_string().ilike(f"%{valor}%")
                if definition["tipo"] == "texto"
                else attr.as_string() == valor
            )
    elif valor or atributo_min is not None or atributo_max is not None:
        raise HTTPException(422, "Selecciona primero el campo que deseas filtrar")
    if existencias or almacen_id:
        if "inventario.ver" not in permissions(db, user):
            raise HTTPException(403, "El filtro de existencias requiere permiso de inventario")
        stock_query = scoped(
            select(Stock.producto_id).join(Product, Product.id == Stock.producto_id),
            Stock.almacen_id,
            user,
        )
        if almacen_id:
            warehouse(db, user, almacen_id, False)
            stock_query = stock_query.where(Stock.almacen_id == almacen_id)
        if existencias == "bajo":
            query = query.where(
                Product.id.in_(stock_query.where(Stock.cantidad <= Product.stock_minimo))
            )
        elif existencias == "agotado":
            query = query.where(Product.id.not_in(stock_query.where(Stock.cantidad > 0)))
        else:
            query = query.where(Product.id.in_(stock_query.where(Stock.cantidad > 0)))
    if q:
        query = query.where(
            or_(
                Product.nombre.ilike(f"%{q}%"),
                Product.sku.ilike(f"%{q}%"),
                Product.marca.ilike(f"%{q}%"),
            )
        )
    if tipo_id:
        query = query.where(Product.tipo_id == tipo_id)
    if categoria_id:
        query = query.where(Product.categoria_id == categoria_id)
    if solo_padres:
        query = query.where(Product.producto_padre_id.is_(None))
    if activo is not None:
        query = query.where(Product.activo == activo)
    sorting = {
        "recientes": Product.id.desc(),
        "nombre": Product.nombre,
        "sku": Product.sku,
        "precio_asc": Product.precio,
        "precio_desc": Product.precio.desc(),
    }
    query = query.order_by(sorting[orden], Product.id)
    return [product_out(db, p, user) for p in db.scalars(query.offset(offset).limit(limit))]


@router.post("/productos", status_code=201)
def create_product(
    data: ProductInput, user=Depends(require("productos.editar")), db: Session = Depends(get_db)
):
    p = save_product(db, data, user)
    db.flush()
    audit(db, user, "crear", "producto", p.id)
    commit(db)
    return product_out(db, p, user)


@router.put("/productos/{id}")
def edit_product(
    id: int,
    data: ProductInput,
    user=Depends(require("productos.editar")),
    db: Session = Depends(get_db),
):
    p = db.get(Product, id, with_for_update=True)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    if (
        db.scalar(select(Product.id).where(Product.producto_padre_id == id).limit(1))
        and data.tipo_id != p.tipo_id
    ):
        raise HTTPException(409, "No cambies el tipo de un producto con variantes")
    p = save_product(db, data, user, p)
    audit(db, user, "editar", "producto", id)
    commit(db)
    return product_out(db, p, user)


@router.patch("/productos/{id}/estado")
def product_status(
    id: int,
    data: StatusInput,
    user=Depends(require("productos.editar")),
    db: Session = Depends(get_db),
):
    p = db.get(Product, id)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    p.activo = data.activo
    audit(db, user, "estado", "producto", id)
    commit(db)
    return product_out(db, p, user)


@router.get("/productos/{id}/imagen")
def product_image(id: int, user=Depends(require("productos.ver")), db: Session = Depends(get_db)):
    p = db.get(Product, id)
    if not p or not p.imagen or not (settings.uploads_dir / p.imagen).is_file():
        raise HTTPException(404, "Imagen no encontrada")
    return FileResponse(
        settings.uploads_dir / p.imagen,
        media_type="image/webp",
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/productos/{id}/imagen")
def upload_image(
    id: int,
    file: UploadFile = File(...),
    user=Depends(require("productos.editar")),
    db: Session = Depends(get_db),
):
    p = db.get(Product, id, with_for_update=True)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    filename = save_image(file.file.read(MAX_BYTES + 1))
    previous = p.imagen
    p.imagen = filename
    audit(db, user, "imagen", "producto", id)
    try:
        commit(db)
    except Exception:
        remove_image(filename)
        raise
    remove_image(previous)
    return product_out(db, p, user)


@router.delete("/productos/{id}/imagen")
def delete_image(id: int, user=Depends(require("productos.editar")), db: Session = Depends(get_db)):
    p = db.get(Product, id, with_for_update=True)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    previous = p.imagen
    p.imagen = None
    audit(db, user, "quitar_imagen", "producto", id)
    commit(db)
    remove_image(previous)
    return product_out(db, p, user)


@router.get("/productos/{id}")
def product_detail(id: int, user=Depends(require("productos.ver")), db: Session = Depends(get_db)):
    p = db.get(Product, id)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    return product_out(db, p, user)


@router.delete("/productos/{id}")
def delete_product(
    id: int, user=Depends(require("productos.eliminar")), db: Session = Depends(get_db)
):
    p = db.get(Product, id, with_for_update=True)
    if not p:
        raise HTTPException(404, "Producto inexistente")
    references = [
        (Product, Product.producto_padre_id),
        (Stock, Stock.producto_id),
        (Movement, Movement.producto_id),
        (SaleLine, SaleLine.producto_id),
        (PurchaseLine, PurchaseLine.producto_id),
    ]
    if any(
        db.scalar(select(model.id).where(column == id).limit(1)) is not None
        for model, column in references
    ):
        raise HTTPException(
            409,
            "Este producto tiene variantes, registros de inventario o historial. Archívalo para conservar sus operaciones.",
        )
    image = p.imagen
    audit(db, user, "eliminar", "producto", id, f"{p.sku} · {p.nombre}")
    db.delete(p)
    commit(db)
    remove_image(image)
    return {"ok": True}
