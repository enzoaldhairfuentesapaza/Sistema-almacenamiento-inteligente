from pydantic import BaseModel, ConfigDict, Field


class SedeEntrada(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    codigo: str = Field(
        min_length=1,
        max_length=30,
        pattern=r"^[A-Z0-9_-]+$",
    )
    nombre: str = Field(min_length=1, max_length=150)
    direccion: str | None = Field(default=None, max_length=300)


class SedeSalida(SedeEntrada):
    model_config = ConfigDict(from_attributes=True)

    id: int
    empresa_id: int
    activo: bool
