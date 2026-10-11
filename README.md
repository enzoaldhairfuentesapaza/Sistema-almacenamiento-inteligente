# Sistema de Almacenamiento Inteligente

Plantilla de gestión empresarial con FastAPI, React y PostgreSQL. Cada empresa utiliza su propia instalación, base de datos y configuración. Dentro de la instalación puede haber varias sedes y almacenes. No hay planes ni suscripciones SaaS.

## Versión 0.2.2

Esta entrega incorpora la interfaz web y los flujos de operación sobre la base inicial. Incluye acceso con sesiones, usuarios y roles configurables, control por sede, catálogo con atributos dinámicos y variantes, inventario y Kardex, transferencias, clientes y proveedores, recepción de compras, ventas, cobros y anulación, constancias PDF internas, QR, importación XLSX/CSV con prevalidación, exportación, estadísticas, auditoría, adaptador LLM y pronósticos con evaluación temporal.

IA y pronósticos quedan para una etapa posterior de trabajo; se conserva su base existente sin ampliarla. Los pronósticos requieren historial; el LLM requiere proveedor y modelo configurados. La constancia de venta es un documento interno: no reemplaza una factura o boleta electrónica. Consulta el alcance pendiente en [docs/requisitos.md](docs/requisitos.md).

## Demo Repuestos

Demo Repuestos mantiene su identidad amarillo/negro, logo e ilustraciones SVG. La versión 0.2.2 incorpora texto más legible, navegación ordenada por Análisis → Administración → Operaciones, controles fijos dentro del menú, acciones con colores y sonidos opcionales. Productos tiene filtros combinados, vista de ficha, editor en página con vista previa en vivo y borrado protegido. Cada módulo incluye Estadísticas y la pantalla global reúne los indicadores autorizados. Una demostración aislada crea 80 productos, 40 clientes, 10 proveedores, 2 sedes, 3 almacenes, 6 cuentas y 180 días completos de operaciones ficticias.

Tras copiar la entrega y preparar el entorno, detén el servidor anterior y ejecuta desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

Elige una contraseña de 12 a 200 caracteres. Abre `http://localhost:8000` e ingresa como `propietario@demo-repuestos.example.com`. La demo usa SQLite local en `.demo`, separada de tu PostgreSQL y sin modificar `.env`. Detalles y casos de prueba en [docs/demo-repuestos.md](docs/demo-repuestos.md).

## Empezar en Windows

1. Conserva `backend/.env`, tu entorno virtual y tu base de datos. Copia los archivos de esta entrega sobre la carpeta del repositorio.
2. Desde la raíz ejecuta `powershell -ExecutionPolicy Bypass -File scripts/setup.ps1`.
3. Desde `backend`, ejecuta `.\.venv\Scripts\python.exe -m app.cli init-owner` una sola vez. Te pedirá correo, nombre y contraseña.
4. Inicia `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload` desde `backend`.
5. Abre `http://localhost:8000`. El backend sirve el frontend compilado y la API en el mismo origen.

Si falta `.env`, el instalador crea una plantilla y se detiene para que completes la contraseña de PostgreSQL. No sobrescribe un `.env` existente. La migración original `863dfa867d08` se conserva y las nuevas migraciones añaden tablas e índices.

Para desarrollar la interfaz, ejecuta `npm run dev` desde `frontend` y abre `http://localhost:5173`. El proxy de Vite comunica React con FastAPI.

## Documentación

- [LOCAL.md](LOCAL.md): actualización, instalación y pruebas en Windows.
- [DEPLOY.md](DEPLOY.md): instalación independiente y despliegue con Docker.
- [docs/requisitos.md](docs/requisitos.md): alcance, estados y criterios de aceptación.
- [docs/arquitectura.md](docs/arquitectura.md): estructura, modelo de datos y reglas.
- [docs/pantallas-permisos.md](docs/pantallas-permisos.md): navegación y autorizaciones.
- [docs/manual-usuario.md](docs/manual-usuario.md): procedimientos de la versión 0.2.2.
- [docs/verificacion.md](docs/verificacion.md): verificaciones ejecutadas y límites.
- `docs/Sistema_Almacenamiento_Documento_Maestro_v0.2.2.docx`: documento maestro actualizado.

## Comprobaciones

```powershell
# Desde backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app tests
# Desde frontend
npm run lint
npm run build
```

Las pruebas usan por defecto una base SQLite desechable separada. En CI se configuró PostgreSQL con `TEST_DATABASE_URL`. No apuntes las pruebas a una base con datos reales: crean y eliminan tablas en la base de prueba.

## Organización

`backend/app/api/routes/` contiene los endpoints; `services/` concentra inventario, catálogo y analítica; `models/` define las tablas; `schemas/` valida entradas; `core/` gestiona configuración y seguridad. `frontend/src/pages/` contiene cada pantalla. `scripts/` incluye instalación y respaldo; `deployment/` contiene el despliegue por empresa.

El proyecto se entrega como código propio para instalaciones comerciales. La política de licencia y los contratos de cada cliente se definirán por separado.
