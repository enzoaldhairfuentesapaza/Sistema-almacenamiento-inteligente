from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EmpresaEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    razon_social: str = Field(min_length=1, max_length=200)
    nombre_comercial: str = Field(min_length=1, max_length=200)
    ruc: str | None = Field(default=None, pattern=r"^[0-9]{11}$")
    moneda: str = Field(default="PEN", pattern=r"^[A-Z]{3}$")
    zona_horaria: str = Field(default="America/Lima", min_length=1, max_length=100)

    @field_validator("zona_horaria")
    @classmethod
    def validar_zona_horaria(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError:
            raise ValueError("Zona horaria desconocida") from None
        return value


class EmpresaSalida(EmpresaEntrada):
    model_config = ConfigDict(from_attributes=True)

    id: int
