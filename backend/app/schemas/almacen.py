from pydantic import BaseModel, ConfigDict, Field


class AlmacenEntrada(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    sede_id: int = Field(gt=0)
    codigo: str = Field(
        min_length=1,
        max_length=30,
        pattern=r"^[A-Z0-9_-]+$",
    )
    nombre: str = Field(min_length=1, max_length=150)


class AlmacenSalida(AlmacenEntrada):
    model_config = ConfigDict(from_attributes=True)

    id: int
    activo: bool
