from fastapi import FastAPI

app = FastAPI(
    title="Sistema de Almacenamiento Inteligente",
    description="API para inventario y gestión empresarial.",
    version="0.1.0",
)


@app.get("/api/v1/health", tags=["Sistema"])
def health():
    return {"status": "ok"}