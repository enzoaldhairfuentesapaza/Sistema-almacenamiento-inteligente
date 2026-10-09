from fastapi import APIRouter

from app.api.routes.empresa import router as empresa_router
from app.api.routes.health import router as health_router
from app.api.routes.sedes import router as sedes_router
from app.api.routes.almacenes import router as almacenes_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(empresa_router)
api_router.include_router(sedes_router)
api_router.include_router(almacenes_router)