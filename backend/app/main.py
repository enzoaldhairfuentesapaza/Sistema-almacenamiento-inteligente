from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from app.api.router import api_router
from app.core.config import BACKEND_DIR

app = FastAPI(
    title="Sistema de Almacenamiento Inteligente",
    version="0.2.1",
    description="Instalación independiente para inventario y gestión empresarial",
)


@app.middleware("http")
async def headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "same-origin"
    if request.url.path.startswith("/api"):
        response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(IntegrityError)
async def conflict(request, exc):
    return JSONResponse(
        status_code=409,
        content={"detail": "Conflicto de datos: revisa códigos duplicados y referencias"},
    )


app.include_router(api_router, prefix="/api/v1")
# Production UI uses hash navigation; API remains on the same origin.
static = BACKEND_DIR.parent / "frontend" / "dist"
if static.is_dir():
    app.mount("/", StaticFiles(directory=static, html=True), name="frontend")
