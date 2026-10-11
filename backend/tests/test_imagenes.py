from io import BytesIO

from PIL import Image

from app.core.config import settings

API = "/api/v1"


def test_image_validation_permissions_and_cleanup(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "uploads_dir", tmp_path)
    product = client.post(
        API + "/productos", json={"sku": "PHOTO-1", "nombre": "Producto con imagen"}
    ).json()
    route = f"{API}/productos/{product['id']}/imagen"
    source = BytesIO()
    Image.new("RGB", (120, 80), "yellow").save(source, "PNG")
    r = client.post(route, files={"file": ("../../nombre.png", source.getvalue(), "image/png")})
    assert r.status_code == 200, r.text
    filename = r.json()["imagen"]
    assert filename.endswith(".webp") and "/" not in filename
    assert len(list(tmp_path.iterdir())) == 1
    loaded = client.get(route)
    assert loaded.status_code == 200 and loaded.headers["content-type"] == "image/webp"
    with Image.open(BytesIO(loaded.content)) as image:
        assert image.size == (120, 80)
    bad = client.post(
        route,
        files={"file": ("imagen.svg", b"<svg><script>alert(1)</script></svg>", "image/svg+xml")},
    )
    assert bad.status_code == 422 and len(list(tmp_path.iterdir())) == 1
    oversized = client.post(
        route, files={"file": ("large.png", b"x" * (5 * 1024 * 1024 + 1), "image/png")}
    )
    assert oversized.status_code == 422
    second = client.post(route, files={"file": ("nuevo.png", source.getvalue(), "image/png")})
    assert second.status_code == 200 and second.json()["imagen"] != filename
    assert not (tmp_path / filename).exists() and len(list(tmp_path.iterdir())) == 1
    assert client.delete(route).status_code == 200
    assert client.get(route).status_code == 404 and not list(tmp_path.iterdir())
    role = client.post(
        API + "/roles", json={"nombre": "Solo lectura", "permisos": ["productos.ver"]}
    ).json()
    r = client.post(
        API + "/usuarios",
        json={
            "nombre": "Lector",
            "email": "photo-reader@example.com",
            "password": "Photo-reader-password-123",
            "roles": [role["id"]],
            "sedes": [1],
        },
    )
    assert r.status_code == 201, r.text
    login = client.post(
        API + "/auth/login",
        json={"email": "photo-reader@example.com", "password": "Photo-reader-password-123"},
    )
    client.headers["x-csrf-token"] = login.json()["csrf"]
    assert (
        client.post(
            route, files={"file": ("photo.png", source.getvalue(), "image/png")}
        ).status_code
        == 403
    )
