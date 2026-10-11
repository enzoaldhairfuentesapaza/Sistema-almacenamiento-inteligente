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
    reportes,
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
    reportes,
):
    api_router.include_router(module.router)
