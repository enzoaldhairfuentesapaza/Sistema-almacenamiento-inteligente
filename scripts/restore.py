"""Restore only into a separate, empty PostgreSQL database. Never cleans existing tables."""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
import psycopg
from app.core.config import settings

parser = argparse.ArgumentParser()
parser.add_argument("archive")
parser.add_argument("--database", required=True)
parser.add_argument("--pg-bin")
args = parser.parse_args()
if args.database == settings.db_name:
    raise SystemExit("Usa una base separada y vacía para verificar la restauración.")
path = Path(args.archive)
if not path.is_file():
    raise SystemExit("Archivo de respaldo no encontrado.")
binary = (
    str(Path(args.pg_bin) / ("pg_restore.exe" if os.name == "nt" else "pg_restore"))
    if args.pg_bin
    else shutil.which("pg_restore")
)
if not binary:
    raise SystemExit("Indica --pg-bin o agrega PostgreSQL al PATH.")
with psycopg.connect(
    host=settings.db_host,
    port=settings.db_port,
    dbname=args.database,
    user=settings.db_user,
    password=settings.db_password.get_secret_value(),
) as conn:
    if conn.execute(
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'"
    ).fetchone()[0]:
        raise SystemExit("La base de destino contiene tablas. No se ha cambiado nada.")
env = {**os.environ, "PGPASSWORD": settings.db_password.get_secret_value()}
subprocess.run(
    [
        binary,
        "-h",
        settings.db_host,
        "-p",
        str(settings.db_port),
        "-U",
        settings.db_user,
        "-d",
        args.database,
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--single-transaction",
        str(path),
    ],
    env=env,
    check=True,
)
print("Restauración completada en la base separada. Valida las tablas y el acceso antes de usarla.")
