from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from uuid import uuid4

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine
from app.main import app
from app.models import Sale
from tests.test_operacion import API, movement, post, product, sale


def test_combined_catalog_filters_and_typed_attributes(client):
    kind = post(
        client,
        "/tipos",
        {
            "nombre": "Técnico",
            "campos": [
                {"clave": "diametro", "etiqueta": "Diámetro", "tipo": "numero"},
                {"clave": "compatible", "etiqueta": "Compatible", "tipo": "booleano"},
                {
                    "clave": "material",
                    "etiqueta": "Material",
                    "tipo": "seleccion",
                    "opciones": ["Acero", "Goma"],
                },
            ],
        },
    )
    category = post(client, "/categorias", {"nombre": "Filtros"})
    a = product(
        client,
        "F-A",
        tipo_id=kind["id"],
        categoria_id=category["id"],
        marca="Demo Marca",
        atributos={"diametro": 42, "compatible": True, "material": "Acero"},
    )
    b = product(
        client,
        "F-B",
        tipo_id=kind["id"],
        atributos={"diametro": 12, "compatible": False, "material": "Goma"},
    )
    client.patch(API + f"/productos/{b['id']}/estado", json={"activo": False})
    common = {
        "tipo_id": kind["id"],
        "categoria_id": category["id"],
        "marca": "Marca",
        "precio_min": 9,
        "precio_max": 11,
        "activo": "true",
        "campo": "diametro",
        "atributo_min": 40,
        "atributo_max": 50,
        "orden": "precio_asc",
    }
    assert [r["id"] for r in client.get(API + "/productos", params=common).json()] == [a["id"]]
    assert (
        client.get(
            API + "/productos",
            params={"tipo_id": kind["id"], "campo": "compatible", "valor": "false"},
        ).json()[0]["id"]
        == b["id"]
    )
    assert (
        client.get(
            API + "/productos",
            params={"tipo_id": kind["id"], "campo": "material", "valor": "Acero"},
        ).json()[0]["id"]
        == a["id"]
    )
    assert client.get(API + "/productos?precio_min=20&precio_max=10").status_code == 422
    assert client.get(API + "/productos?campo=unknown&valor=x").status_code == 422
    assert client.get(API + "/productos?orden=sql").status_code == 422
    assert (
        client.get(
            API + "/productos",
            params={"tipo_id": kind["id"], "campo": "material", "atributo_min": 1},
        ).status_code
        == 422
    )
    assert (
        client.get(
            API + "/productos", params={"tipo_id": kind["id"], "campo": "diametro", "valor": "nan"}
        ).status_code
        == 422
    )


def test_stock_filter_and_statistics_keep_site_and_cost_scope(client):
    other = post(client, "/sedes", {"codigo": "JUL", "nombre": "Juliaca"})
    store = post(
        client, "/almacenes", {"sede_id": other["id"], "codigo": "JUL", "nombre": "Tienda Juliaca"}
    )
    a = product(client, "A")
    b = product(client, "B")
    movement(client, a["id"], "5")
    post(
        client,
        "/movimientos",
        dict(
            producto_id=b["id"],
            almacen_id=store["id"],
            cantidad="9",
            tipo="entrada",
            motivo="Otra sede",
        ),
    )
    local_sale = sale(client, a["id"], "1")
    post(
        client,
        "/ventas",
        {
            "request_id": str(uuid4()),
            "almacen_id": store["id"],
            "items": [{"producto_id": b["id"], "cantidad": "2"}],
        },
    )
    role = post(
        client,
        "/roles",
        {
            "nombre": "Reportes locales",
            "permisos": [
                "productos.ver",
                "inventario.ver",
                "ventas.ver",
                "reportes.ver",
                "contactos.ver",
                "excel.exportar",
            ],
        },
    )
    user = post(
        client,
        "/usuarios",
        {
            "nombre": "Analista local",
            "email": "stats@example.com",
            "password": "Stats-password-123",
            "roles": [role["id"]],
            "sedes": [1],
        },
    )
    with TestClient(app) as c:
        login = post(
            c, "/auth/login", {"email": user["email"], "password": "Stats-password-123"}, 200
        )
        c.headers["x-csrf-token"] = login["csrf"]
        assert [p["id"] for p in c.get(API + "/productos?existencias=disponible").json()] == [
            a["id"]
        ]
        assert [p["id"] for p in c.get(API + "/productos?existencias=agotado").json()] == [b["id"]]
        assert (
            c.get(API + f"/productos?existencias=disponible&almacen_id={store['id']}").status_code
            == 403
        )
        report = c.get(API + "/reportes/modulos/ventas").json()
        metrics = {m["etiqueta"]: m["valor"] for m in report["indicadores"]}
        assert metrics["Ventas confirmadas"] == 1
        assert Decimal(str(metrics["Importe confirmado"])) == Decimal(str(local_sale["total"]))
        assert sum(Decimal(str(x["valor"])) for x in report["serie"]) == Decimal(
            str(local_sale["total"])
        )
        assert "B" not in str(report["distribucion"])
        inventory = c.get(API + "/reportes/modulos/inventario").json()
        assert all(
            m["etiqueta"] != "Valor actual a costo de catálogo" for m in inventory["indicadores"]
        )
        assert inventory["distribucion"] == [{"etiqueta": "Principal", "valor": 1}]
        assert c.get(API + "/reportes/modulos/compras").status_code == 403
        assert c.get(API + "/reportes/modulos/accesos").status_code == 403
        assert c.get(API + "/reportes/modulos/auditoria").status_code == 403
        assert c.delete(API + f"/productos/{b['id']}").status_code == 403


def test_reports_use_company_dates_and_validate_period(client):
    p = product(client)
    movement(client, p["id"])
    s = sale(client, p["id"])
    # 01:00 UTC is still the previous calendar day in Lima.
    with Session(engine) as db:
        db.get(Sale, s["id"]).fecha = datetime(2026, 10, 11, 1, 0, tzinfo=timezone.utc)
        db.commit()
    assert (
        client.get(API + "/reportes/modulos/ventas?desde=2026-10-10&hasta=2026-10-10").json()[
            "indicadores"
        ][0]["valor"]
        == 1
    )
    assert (
        client.get(API + "/reportes/modulos/ventas?desde=2026-10-11&hasta=2026-10-11").json()[
            "indicadores"
        ][0]["valor"]
        == 0
    )
    assert (
        client.get(API + "/reportes/modulos/ventas?desde=2026-10-12&hasta=2026-10-10").status_code
        == 422
    )
    assert (
        client.get(API + "/reportes/modulos/ventas?desde=2020-01-01&hasta=2026-10-10").status_code
        == 422
    )
    for module in [
        "productos",
        "inventario",
        "contactos",
        "organizacion",
        "accesos",
        "auditoria",
        "compras",
        "excel",
    ]:
        result = client.get(API + "/reportes/modulos/" + module)
        assert result.status_code == 200, result.text
    assert client.get(API + "/reportes/modulos/missing").status_code == 404


def test_delete_product_keeps_history_and_removes_unused_photo(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_dir", tmp_path / "uploads")
    p = product(client, "UNUSED")
    image = BytesIO()
    Image.new("RGB", (20, 20), "yellow").save(image, "PNG")
    r = client.post(
        API + f"/productos/{p['id']}/imagen",
        files={"file": ("test.png", image.getvalue(), "image/png")},
    )
    assert r.status_code == 200
    assert len(list(settings.uploads_dir.iterdir())) == 1
    assert client.delete(API + f"/productos/{p['id']}").status_code == 200
    assert not list(settings.uploads_dir.iterdir())
    assert client.get(API + f"/productos/{p['id']}").status_code == 404
    parent = product(client, "PARENT")
    product(client, "CHILD", producto_padre_id=parent["id"])
    assert client.delete(API + f"/productos/{parent['id']}").status_code == 409
    used = product(client, "USED")
    movement(client, used["id"], "3")
    sale(client, used["id"], "1")
    assert client.delete(API + f"/productos/{used['id']}").status_code == 409
    assert client.get(API + f"/productos/{used['id']}").status_code == 200
