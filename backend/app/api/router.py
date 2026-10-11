from fastapi import APIRouter

from app.api.routes import (
    admin,
    auth,
    catalogo,
    comercial,
    excel,
    health,
    inteligencia,
    inventario,
    organizacion,
)

api_router = APIRouter()
for module in (
    health,
    auth,
    admin,
    organizacion,
    catalogo,
    inventario,
    comercial,
    excel,
    inteligencia,
):
    api_router.include_router(module.router)
