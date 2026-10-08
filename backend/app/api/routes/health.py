from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok"}