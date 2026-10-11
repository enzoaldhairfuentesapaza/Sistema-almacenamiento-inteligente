import secrets
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import COOKIE, audit, current_user, password_hash, token_digest, user_out
from app.db.session import get_db
from app.models import AuthSession, User
from app.schemas.sistema import ChangePassword, Login

router = APIRouter(prefix="/auth", tags=["Acceso"])
attempts = defaultdict(deque)
lock = Lock()
dummy = password_hash.hash("password-for-timing-only-never-a-login")


@router.post("/login")
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    origin = request.headers.get("origin")
    if origin and origin not in settings.allowed_origins.split(","):
        raise HTTPException(403, "Origen no autorizado")
    key = ((request.client.host if request.client else ""), str(data.email).lower())
    with lock:
        queue = attempts[key]
        while queue and queue[0] < monotonic() - 300:
            queue.popleft()
        if len(queue) >= 10:
            raise HTTPException(429, "Demasiados intentos; espera cinco minutos")
        queue.append(monotonic())
    user = db.scalar(select(User).where(User.email == str(data.email).lower()))
    verified = password_hash.verify(data.password, user.password_hash if user else dummy)
    if not verified or not user or not user.activo:
        raise HTTPException(401, "Credenciales incorrectas")
    with lock:
        attempts.pop(key, None)
    token = secrets.token_urlsafe(40)
    session = AuthSession(
        usuario_id=user.id,
        token_hash=token_digest(token),
        csrf=secrets.token_urlsafe(32),
        expira=datetime.now(timezone.utc) + timedelta(hours=settings.session_hours),
    )
    db.execute(delete(AuthSession).where(AuthSession.expira < datetime.now(timezone.utc)))
    db.add(session)
    audit(db, user, "login", "usuario", user.id)
    db.commit()
    response.set_cookie(
        COOKIE,
        token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.session_hours * 3600,
        path="/",
    )
    return {"usuario": user_out(db, user), "csrf": session.csrf, "demo": settings.demo_mode}


@router.get("/me")
def me(request: Request, user=Depends(current_user), db: Session = Depends(get_db)):
    return {
        "usuario": user_out(db, user),
        "csrf": request.state.auth_session.csrf,
        "demo": settings.demo_mode,
    }


@router.post("/logout")
def logout(
    request: Request, response: Response, user=Depends(current_user), db: Session = Depends(get_db)
):
    db.delete(request.state.auth_session)
    audit(db, user, "logout", "usuario", user.id)
    db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.post("/password")
def change_password(
    data: ChangePassword, user=Depends(current_user), db: Session = Depends(get_db)
):
    if not password_hash.verify(data.actual, user.password_hash):
        raise HTTPException(400, "Contraseña actual incorrecta")
    user.password_hash = password_hash.hash(data.nueva)
    db.execute(delete(AuthSession).where(AuthSession.usuario_id == user.id))
    audit(db, user, "password", "usuario", user.id)
    db.commit()
    return {"ok": True}
