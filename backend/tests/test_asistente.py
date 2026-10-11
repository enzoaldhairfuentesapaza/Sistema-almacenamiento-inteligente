import httpx

from app.api.routes import inteligencia
from app.core.config import settings


def test_assistant_tools_have_no_write_or_sql(client, monkeypatch):
    client.post(
        "/api/v1/productos",
        json={"sku": "SAFE", "nombre": "Filtro real", "precio": "10", "costo": "7"},
    )
    client.post(
        "/api/v1/movimientos",
        json={
            "producto_id": 1,
            "almacen_id": 1,
            "cantidad": "12",
            "tipo": "entrada",
            "motivo": "Carga inicial",
        },
    )
    monkeypatch.setattr(settings, "llm_model", "test-model")
    observed = []

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kwargs):
            observed.append(kwargs["json"])
            if len(observed) == 1:
                return httpx.Response(
                    200,
                    request=httpx.Request("POST", url),
                    json={
                        "choices": [
                            {
                                "message": {
                                    "content": None,
                                    "tool_calls": [
                                        {
                                            "id": "call-1",
                                            "type": "function",
                                            "function": {
                                                "name": "consultar_existencias",
                                                "arguments": '{"consulta":"Filtro"}',
                                            },
                                        }
                                    ],
                                }
                            }
                        ]
                    },
                )
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "choices": [{"message": {"content": "Quedan 12 unidades.", "tool_calls": []}}]
                },
            )

    monkeypatch.setattr(inteligencia.httpx, "Client", lambda **kwargs: FakeClient())
    r = client.post("/api/v1/asistente", json={"pregunta": "¿Cuánto stock hay de Filtro?"})
    assert r.status_code == 200, r.text
    assert r.json()["fuentes"][0]["herramienta"] == "consultar_existencias"
    assert "12.000" in observed[1]["messages"][-1]["content"]
    assert all(
        t["function"]["name"] not in ("sql", "crear_venta", "cambiar_stock")
        for t in observed[0]["tools"]
    )


def test_assistant_rejects_unannounced_tool(client, monkeypatch):
    monkeypatch.setattr(settings, "llm_model", "test-model")

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def post(self, url, **kwargs):
            return httpx.Response(
                200,
                request=httpx.Request("POST", url),
                json={
                    "choices": [
                        {
                            "message": {
                                "content": None,
                                "tool_calls": [
                                    {"id": "bad", "function": {"name": "sql", "arguments": "{}"}}
                                ],
                            }
                        }
                    ]
                },
            )

    monkeypatch.setattr(inteligencia.httpx, "Client", lambda **kwargs: FakeClient())
    assert (
        client.post("/api/v1/asistente", json={"pregunta": "Haz cualquier consulta"}).status_code
        == 502
    )
