"""Create PostgreSQL custom-format backups without putting credentials in command arguments."""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.core.config import settings

parser = argparse.ArgumentParser()
parser.add_argument("--pg-bin", help="Carpeta bin de PostgreSQL si no está en PATH")
parser.add_argument("--output", default=str(root / "backups"))
args = parser.parse_args()
binary = (
    str(Path(args.pg_bin) / ("pg_dump.exe" if os.name == "nt" else "pg_dump"))
    if args.pg_bin
    else shutil.which("pg_dump")
)
if not binary:
    raise SystemExit("Indica --pg-bin o agrega PostgreSQL al PATH.")
if settings.database_url:
    raise SystemExit(
        "Este script utiliza los campos DB_* de PostgreSQL; elimina DATABASE_URL para usarlo."
    )
destination = Path(args.output)
destination.mkdir(parents=True, exist_ok=True)
path = destination / f"almacenamiento-{datetime.now(timezone.utc):%Y%m%d-%H%M%S}.dump"
if path.exists():
    raise SystemExit("Ya existe un respaldo con ese nombre; espera un segundo y reintenta.")
env = {**os.environ, "PGPASSWORD": settings.db_password.get_secret_value()}
result = subprocess.run(
    [
        binary,
        "-h",
        settings.db_host,
        "-p",
        str(settings.db_port),
        "-U",
        settings.db_user,
        "-d",
        settings.db_name,
        "--no-owner",
        "--format=custom",
        "--file",
        str(path),
    ],
    env=env,
    check=False,
)
if result.returncode:
    if path.exists():
        path.unlink()
    raise SystemExit("No se pudo completar el respaldo.")
print(f"Respaldo creado: {path}")
