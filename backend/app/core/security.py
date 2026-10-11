import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models import Almacen, Audit, AuthSession, Role, Sede, User

password_hash = PasswordHash.recommended()
COOKIE = "almacen_session"
PERMISSIONS = {
    "empresa.ver": "Consultar empresa",
    "empresa.editar": "Configurar empresa",
    "sedes.ver": "Consultar sedes y almacenes",
    "sedes.editar": "Gestionar sedes y almacenes",
    "productos.ver": "Consultar catálogo",
    "productos.editar": "Gestionar catálogo y tipos",
    "productos.eliminar": "Eliminar productos sin stock, variantes ni historial",
    "costos.ver": "Consultar costos y márgenes",
    "inventario.ver": "Consultar existencias y Kardex",
    "inventario.mover": "Registrar entradas y salidas",
    "inventario.ajustar": "Ajustar y transferir existencias",
    "contactos.ver": "Consultar clientes y proveedores",
    "contactos.editar": "Gestionar contactos",
    "ventas.ver": "Consultar ventas",
    "ventas.crear": "Registrar ventas",
    "ventas.anular": "Anular ventas",
    "pagos.registrar": "Registrar cobros",
    "compras.ver": "Consultar compras",
    "compras.crear": "Recibir compras",
    "reportes.ver": "Consultar estadísticas",
    "excel.importar": "Importar catálogo",
    "excel.exportar": "Exportar datos",
    "ia.usar": "Consultar asistente",
    "pronosticos.ver": "Calcular pronósticos",
    "auditoria.ver": "Consultar auditoría",
}


def token_digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


def permissions(db, user):
    if user.propietario:
        return set(PERMISSIONS) | {"usuarios.editar", "roles.editar"}
    return set().union(
        *(set(r.permisos) for r in db.scalars(select(Role).where(Role.id.in_(user.roles))).all())
    )


def current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get(COOKIE, "")
    session = (
        db.scalar(select(AuthSession).where(AuthSession.token_hash == token_digest(token)))
        if token
        else None
    )
    expires = session.expira if session else datetime.min.replace(tzinfo=timezone.utc)
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    user = db.get(User, session.usuario_id) if session else None
    if not user or not user.activo or expires <= datetime.now(timezone.utc):
        raise HTTPException(401, "Inicia sesión para continuar")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("origin")
        if origin and origin not in settings.allowed_origins.split(","):
            raise HTTPException(403, "Origen no autorizado")
        if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf):
            raise HTTPException(403, "Token CSRF inválido; vuelve a iniciar sesión")
    request.state.auth_session = session
    return user


def require(code):
    def check(user: User = Depends(current_user), db: Session = Depends(get_db)):
        if code not in permissions(db, user):
            raise HTTPException(403, "No tienes permiso para esta acción")
        return user

    return check


def owner(user: User = Depends(current_user)):
    if not user.propietario:
        raise HTTPException(403, "Acción reservada al propietario")
    return user


def site_access(user, sede_id):
    if not user.propietario and sede_id not in user.sedes:
        raise HTTPException(403, "No tienes acceso a esta sede")


def warehouse(db, user, almacen_id, active=True):
    row = db.get(Almacen, almacen_id)
    if not row:
        raise HTTPException(404, "Almacén no encontrado")
    site_access(user, row.sede_id)
    sede = db.get(Sede, row.sede_id)
    if active and (not row.activo or not sede.activo):
        raise HTTPException(409, "La sede o el almacén está inactivo")
    return row


def scoped(query, column, user):
    if user.propietario:
        return query
    return query.where(column.in_(select(Almacen.id).where(Almacen.sede_id.in_(user.sedes))))


def audit(db, user, action, entity, entity_id=None, detail=""):
    db.add(
        Audit(
            usuario_id=user.id if user else None,
            accion=action,
            entidad=entity,
            entidad_id=entity_id,
            detalle=detail,
        )
    )


def user_out(db, user):
    return dict(
        id=user.id,
        nombre=user.nombre,
        email=user.email,
        propietario=user.propietario,
        activo=user.activo,
        roles=user.roles,
        sedes=user.sedes,
        permisos=sorted(permissions(db, user)),
    )
