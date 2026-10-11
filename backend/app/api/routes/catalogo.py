from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import audit, require
from app.db.session import get_db
from app.models import Category, Product, ProductType
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
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=1000),
    user=Depends(require("productos.ver")),
    db: Session = Depends(get_db),
):
    query = select(Product).order_by(Product.id.desc())
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
