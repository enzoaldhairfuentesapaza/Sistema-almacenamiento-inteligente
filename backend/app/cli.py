"""Local installation commands; never expose owner bootstrap as an HTTP endpoint."""

import argparse
from decimal import Decimal
from getpass import getpass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.roles import ROLE_CODES
from app.core.security import audit, password_hash
from app.db.session import engine
from app.models import Almacen, Empresa, Product, ProductType, Role, Sede, User
from app.services.inventario import delta, lock_products


def init_owner(email=None, name=None):
    from pydantic import EmailStr, TypeAdapter

    with Session(engine) as db:
        if db.scalar(select(User.id).where(User.propietario.is_(True))):
            raise SystemExit("Ya existe un propietario; utiliza su cuenta o reset-password.")
        email = str(
            TypeAdapter(EmailStr).validate_python(email or input("Correo del propietario: "))
        ).lower()
        name = name or input("Nombre: ").strip()
        password = getpass("Contraseña (mínimo 12 caracteres): ")
        if not 12 <= len(password) <= 200 or password != getpass("Repite contraseña: "):
            raise SystemExit("Contraseña corta o confirmación diferente.")
        if not name:
            raise SystemExit("El nombre es obligatorio.")
        for title, codes in ROLE_CODES.items():
            if not db.scalar(select(Role).where(Role.nombre == title)):
                db.add(Role(nombre=title, permisos=codes))
        user = User(
            nombre=name,
            email=email,
            password_hash=password_hash.hash(password),
            propietario=True,
            roles=[],
            sedes=[],
        )
        db.add(user)
        db.flush()
        audit(db, user, "instalacion", "usuario", user.id)
        db.commit()
    print("Propietario creado. Inicia sesión en la aplicación con ese correo y contraseña.")


def reset_password(email):
    from sqlalchemy import delete

    from app.models import AuthSession

    with Session(engine) as db:
        user = db.scalar(select(User).where(User.email == email.lower()))
        if not user:
            raise SystemExit("Usuario no encontrado")
        new = getpass("Nueva contraseña: ")
        if not 12 <= len(new) <= 200 or new != getpass("Repite contraseña: "):
            raise SystemExit("Contraseña inválida")
        user.password_hash = password_hash.hash(new)
        db.execute(delete(AuthSession).where(AuthSession.usuario_id == user.id))
        audit(db, user, "reset_local", "usuario", user.id)
        db.commit()
    print("Contraseña actualizada y sesiones revocadas.")


def seed_demo():
    if settings.app_env == "production":
        raise SystemExit("La demostración está deshabilitada en producción.")
    with Session(engine) as db:
        owner = db.scalar(select(User).where(User.propietario.is_(True)))
        if not owner:
            raise SystemExit("Ejecuta init-owner primero.")
        if db.scalar(select(Product.id).limit(1)):
            raise SystemExit("El catálogo debe estar vacío para cargar la demostración.")
        company = db.get(Empresa, 1)
        if not company:
            db.add(
                Empresa(
                    id=1, razon_social="Empresa de demostración", nombre_comercial="Almacén Demo"
                )
            )
            db.flush()
        site = db.scalar(select(Sede).where(Sede.activo.is_(True)).order_by(Sede.id))
        if not site:
            site = Sede(empresa_id=1, codigo="DEMO", nombre="Sede de demostración")
            db.add(site)
            db.flush()
        store = db.scalar(
            select(Almacen)
            .where(Almacen.sede_id == site.id, Almacen.activo.is_(True))
            .order_by(Almacen.id)
        )
        if not store:
            store = Almacen(sede_id=site.id, codigo="DEMO", nombre="Almacén de demostración")
            db.add(store)
            db.flush()
        kind = ProductType(
            nombre="Repuesto Demo",
            campos=[
                {
                    "clave": "compatibilidad",
                    "etiqueta": "Compatibilidad",
                    "tipo": "texto",
                    "obligatorio": False,
                    "opciones": [],
                }
            ],
        )
        db.add(kind)
        db.flush()
        for sku, name, price, cost, qty in [
            ("REP-001", "Filtro de aceite", 45, 28, 30),
            ("REP-002", "Correa de transmisión", 85, 52, 18),
            ("REP-003", "Rodamiento industrial", 125, 80, 3),
        ]:
            p = Product(
                sku=sku,
                nombre=name,
                tipo_id=kind.id,
                precio=Decimal(price),
                costo=Decimal(cost),
                stock_minimo=5,
                atributos={"compatibilidad": "Ejemplo"},
            )
            db.add(p)
            db.flush()
            lock_products(db, [p.id])
            delta(db, owner, p.id, store.id, Decimal(qty), "entrada", "Existencias de demostración")
        audit(db, owner, "demo", "instalacion")
        db.commit()
    print("Catálogo de demostración creado. No contiene historial artificial de ventas.")


def demo_repuestos():
    import json
    from pathlib import Path

    from app.services.demo import seed_repuestos

    if settings.app_env == "production":
        raise SystemExit("La demostración está deshabilitada en producción")
    name = engine.url.database or ""
    if not (
        (
            engine.dialect.name == "sqlite"
            and settings.database_url
            and Path(name).name == "demo-repuestos.sqlite3"
        )
        or (engine.dialect.name == "postgresql" and name == "demo_repuestos_db")
    ):
        raise SystemExit(
            "Utiliza scripts/demo.ps1 para una base aislada. También se admite PostgreSQL demo_repuestos_db mediante DB_NAME explícito."
        )
    with Session(engine) as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            raise SystemExit(
                "La base de demostración ya tiene usuarios. No se modificó ningún dato."
            )
        password = getpass("Contraseña para las 6 cuentas ficticias (12-200 caracteres): ")
        if not 12 <= len(password) <= 200 or password != getpass("Repite contraseña: "):
            raise SystemExit("Contraseña inválida o confirmación diferente")
        try:
            result = seed_repuestos(db, password)
            db.commit()
        except ValueError as exc:
            raise SystemExit(str(exc)) from None
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print(
        "Acceso: propietario@demo-repuestos.example.com; utiliza la contraseña que acabas de elegir."
    )
    print("Otras cuentas: admin, almacen, ventas, analista y lector con el mismo dominio.")
    print("Todos los datos son ficticios. El LLM requiere configurar un proveedor por separado.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "command", choices=["init-owner", "reset-password", "seed-demo", "demo-repuestos"]
    )
    parser.add_argument("--email")
    parser.add_argument("--name")
    args = parser.parse_args()
    if args.command == "init-owner":
        init_owner(args.email, args.name)
    elif args.command == "reset-password":
        if not args.email:
            parser.error("--email es requerido")
        reset_password(args.email)
    elif args.command == "seed-demo":
        seed_demo()
    else:
        demo_repuestos()


if __name__ == "__main__":
    main()
