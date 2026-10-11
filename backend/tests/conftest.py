import os
from pathlib import Path

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or "sqlite:///" + str(
    Path(__file__).resolve().parents[3] / "tests.db"
)
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import password_hash
from app.db.base import Base
from app.db.session import engine
from app.main import app
from app.models import Almacen, Empresa, Sede, User


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(
            User(
                nombre="Owner",
                email="owner@example.com",
                password_hash=password_hash.hash("Safe-test-password-123"),
                propietario=True,
                roles=[],
                sedes=[],
            )
        )
        db.add(Empresa(id=1, razon_social="Demo", nombre_comercial="Demo"))
        db.flush()
        db.add(Sede(empresa_id=1, codigo="AQP", nombre="Arequipa"))
        db.flush()
        db.add(Almacen(sede_id=1, codigo="A", nombre="Principal"))
        db.commit()
    with TestClient(app) as c:
        r = c.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "Safe-test-password-123"},
        )
        assert r.status_code == 200, r.text
        c.headers["x-csrf-token"] = r.json()["csrf"]
        yield c
