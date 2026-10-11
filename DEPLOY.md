# Despliegue por empresa

Cada cliente utiliza una base, configuración, dominio y credenciales separados. Sedes y almacenes pertenecen a esa empresa. El repositorio es la plantilla común y no guarda datos reales de clientes.

## Publicación con Docker

La configuración está incluida, pero no se desplegó en un hosting real durante esta entrega. Desde la raíz:

1. Crea `deployment/.env` con `DB_PASSWORD`, una contraseña propia de la instalación. No se sube a Git.
2. Para prueba local, conserva `APP_ENV=development`, `COOKIE_SECURE=false` y `ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000`.
3. Ejecuta:

```bash
docker compose -f deployment/compose.yml --env-file deployment/.env up -d --build
docker compose -f deployment/compose.yml --env-file deployment/.env exec app python -m alembic upgrade head
docker compose -f deployment/compose.yml --env-file deployment/.env exec app python -m app.cli init-owner
```

4. Abre `http://localhost:8000`. Configura empresa y ubicaciones. El volumen `postgres_data` conserva la base de datos cuando se recrea el contenedor.

La base no expone un puerto público. La aplicación escucha en el host solo en `127.0.0.1:8000`, lista para un proxy en el servidor. Docker usa PostgreSQL 18; si la instalación de un cliente utiliza otro motor o versión, verifica las migraciones antes de migrar sus datos.

## Dominio y HTTPS

Configura un proxy de tu proveedor hacia la aplicación, certificado TLS y dominio del cliente. En `deployment/.env` define:

```dotenv
APP_ENV=production
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://inventario.tu-empresa.com
```

Recrea el contenedor de la aplicación para aplicar las variables. En producción se exige la cookie segura. La misma URL sirve React y `/api/v1`, por lo que no se necesita abrir CORS a otros sitios. La API de comprobación de estado permanece pública; las rutas de operación están protegidas por sesión y permisos.

Se ofrece una base de despliegue, no una configuración de alta disponibilidad. El límite de intentos de login es por proceso. Si se habilitan varios workers, aplica también limitación de solicitudes en el proxy. Para un cliente concreto define monitoreo, retención de logs y frecuencia de respaldo.

## Respaldos y recuperación

En Windows o Linux con PostgreSQL instalado, `scripts/backup.py` utiliza `pg_dump` y un archivo custom. La contraseña se transmite por variable al subproceso y no aparece en el comando. Guarda los respaldos fuera del repositorio y del disco principal.

```powershell
.\backend\.venv\Scripts\python.exe scripts\backup.py --pg-bin "D:\PostgreSQL\18.6\bin"
```

Para probar la restauración, crea una base nueva y vacía, propiedad del mismo usuario. Desde `psql` con cuenta autorizada:

```sql
CREATE DATABASE almacenamiento_restauracion OWNER almacenamiento_app;
```

Después, desde la raíz:

```powershell
.\backend\.venv\Scripts\python.exe scripts\restore.py "backups\ARCHIVO.dump" --database almacenamiento_restauracion --pg-bin "D:\PostgreSQL\18.6\bin"
```

El script rechaza restaurar sobre la base principal o una base con tablas. Verifica conteos, integridad, acceso y documentos antes de cambiar una instalación. El procedimiento se incluye como código y guía; no se ha hecho una restauración de PostgreSQL real en este entorno de trabajo.

## Actualizar una instalación

Respalda primero, verifica las migraciones en una copia y aplica `alembic upgrade head`. Compila la interfaz nueva. No uses `downgrade` en una base con movimientos y ventas sin un plan de recuperación: eliminaría tablas introducidas por esa revisión.

La configuración de cada empresa y sus secretos quedan fuera del código. Las personalizaciones deberían mantener módulos compartidos y usar configuración donde sea posible. No hay suscripciones ni un panel central de múltiples empresas.

## Comprobantes y pagos

El PDF es una constancia interna y lo declara expresamente. La emisión SUNAT, series fiscales, notas de crédito y validación con proveedor autorizado aún no están implementadas. Yape/Plin/transferencia son cobros manuales verificados con referencia, no confirmaciones automáticas de una pasarela.

## Archivos de productos

La migración `ae2809d10001` agrega `productos.imagen`. El volumen `catalog_images` conserva los WebP normalizados; no los incluyas en Git ni dentro de la imagen de aplicación. Respalda el volumen y la base en el mismo período y restaura ambos. `scripts/backup.py` y `restore.py` cubren la base; la copia/restauración de imágenes se realiza por separado. El contenedor crea la carpeta con propietario `appuser`; la persistencia de volumen y el despliegue deben verificarse en el servidor real.

La demo de Windows fuerza desarrollo y usa su propia base SQLite. No se habilita con `APP_ENV=production`; tampoco se permite `DEMO_MODE=true` en producción.
