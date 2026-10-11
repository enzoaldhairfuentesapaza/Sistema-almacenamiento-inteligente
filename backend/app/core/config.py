from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "almacenamiento_db"
    db_user: str = "almacenamiento_app"
    db_password: SecretStr = SecretStr("")
    database_url: str | None = None
    uploads_dir: Path = BACKEND_DIR / "var" / "uploads"
    app_env: str = "development"
    demo_mode: bool = False
    cookie_secure: bool = False
    session_hours: int = Field(default=8, ge=1, le=24)
    allowed_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000"
    )
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: SecretStr = SecretStr("")
    llm_model: str = ""
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    @model_validator(mode="after")
    def production_settings(self):
        if self.app_env == "production" and self.demo_mode:
            raise ValueError("La demostración está deshabilitada en producción")
        if self.app_env == "production" and not self.cookie_secure:
            raise ValueError("En producción COOKIE_SECURE debe ser true y la web debe usar HTTPS")
        if (
            self.app_env == "production"
            and self.database_url
            and self.database_url.startswith("sqlite")
        ):
            raise ValueError("Producción requiere PostgreSQL")
        return self


settings = Settings()
