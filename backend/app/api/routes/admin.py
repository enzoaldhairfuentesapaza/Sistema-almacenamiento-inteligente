from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.security import PERMISSIONS, audit, owner, password_hash, require, user_out
from app.db.session import get_db
from app.models import Audit, AuthSession, Role, Sede, User
from app.schemas.sistema import RoleInput, UserInput
from app.services.common import commit, row_out

router = APIRouter(tags=["Administración"])


@router.get("/permisos")
def permission_list(user=Depends(owner)):
    return [{"codigo": k, "descripcion": v} for k, v in PERMISSIONS.items()]


@router.get("/roles")
def roles(user=Depends(owner), db: Session = Depends(get_db)):
    return [row_out(r) for r in db.scalars(select(Role).order_by(Role.id))]


def validate_role(data):
    if set(data.permisos) - set(PERMISSIONS):
        raise HTTPException(422, "Permisos desconocidos o reservados")


@router.post("/roles", status_code=201)
def create_role(data: RoleInput, user=Depends(owner), db: Session = Depends(get_db)):
    validate_role(data)
    r = Role(**data.model_dump())
    db.add(r)
    db.flush()
    audit(db, user, "crear", "rol", r.id)
    commit(db)
    return row_out(r)


@router.put("/roles/{id}")
def update_role(id: int, data: RoleInput, user=Depends(owner), db: Session = Depends(get_db)):
    validate_role(data)
    r = db.get(Role, id)
    if not r:
        raise HTTPException(404, "Rol no encontrado")
    r.nombre = data.nombre
    r.permisos = data.permisos
    audit(db, user, "editar", "rol", id)
    commit(db)
    return row_out(r)


@router.get("/usuarios")
def users(user=Depends(owner), db: Session = Depends(get_db)):
    return [user_out(db, r) for r in db.scalars(select(User).order_by(User.id))]


def validate_user(db, data):
    if set(data.roles) - set(db.scalars(select(Role.id))):
        raise HTTPException(422, "Rol inexistente")
    if set(data.sedes) - set(db.scalars(select(Sede.id))):
        raise HTTPException(422, "Sede inexistente")


@router.post("/usuarios", status_code=201)
def create_user(data: UserInput, user=Depends(owner), db: Session = Depends(get_db)):
    validate_user(db, data)
    if not data.password:
        raise HTTPException(422, "Contraseña requerida")
    r = User(
        **data.model_dump(exclude={"password"}), password_hash=password_hash.hash(data.password)
    )
    r.email = str(data.email).lower()
    db.add(r)
    db.flush()
    audit(db, user, "crear", "usuario", r.id)
    commit(db)
    return user_out(db, r)


@router.put("/usuarios/{id}")
def update_user(id: int, data: UserInput, user=Depends(owner), db: Session = Depends(get_db)):
    r = db.get(User, id)
    if not r:
        raise HTTPException(404, "Usuario no encontrado")
    if r.propietario:
        raise HTTPException(
            409, "El propietario cambia su contraseña desde su perfil; no se modifica por esta ruta"
        )
    validate_user(db, data)
    for k, v in data.model_dump(exclude={"password"}).items():
        setattr(r, k, v)
    r.email = str(data.email).lower()
    if data.password:
        r.password_hash = password_hash.hash(data.password)
    db.execute(delete(AuthSession).where(AuthSession.usuario_id == id))
    audit(db, user, "editar", "usuario", id)
    commit(db)
    return user_out(db, r)


@router.get("/auditoria")
def audit_list(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    user=Depends(require("auditoria.ver")),
    db: Session = Depends(get_db),
):
    # Global audit is deliberately owner-only: it contains cross-site actions.
    if not user.propietario:
        raise HTTPException(403, "Auditoría global reservada al propietario")
    return [
        dict(**row_out(r), usuario=nombre or "Sistema")
        for r, nombre in db.execute(
            select(Audit, User.nombre)
            .outerjoin(User, User.id == Audit.usuario_id)
            .order_by(Audit.id.desc())
            .offset(offset)
            .limit(limit)
        )
    ]
