"""Normalize raster uploads; never serve original bytes, filenames or embedded metadata."""

import warnings
from io import BytesIO
from uuid import uuid4

from fastapi import HTTPException
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

MAX_BYTES = 5 * 1024 * 1024
MAX_PIXELS = 20_000_000


def save_image(content):
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(422, "La imagen debe pesar como máximo 5 MB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise HTTPException(422, "Selecciona una imagen JPG, PNG o WebP")
                if source.width * source.height > MAX_PIXELS:
                    raise HTTPException(422, "La imagen debe tener como máximo 20 megapíxeles")
                normalized = ImageOps.exif_transpose(source).convert("RGB")
                normalized.thumbnail((1200, 1200))
                result = BytesIO()
                normalized.save(result, format="WEBP", quality=85)
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(422, "El archivo no es una imagen válida") from None
    directory = settings.uploads_dir
    directory.mkdir(parents=True, exist_ok=True)
    filename = uuid4().hex + ".webp"
    (directory / filename).write_bytes(result.getvalue())
    return filename


def remove_image(filename):
    if filename:
        (settings.uploads_dir / filename).unlink(missing_ok=True)
