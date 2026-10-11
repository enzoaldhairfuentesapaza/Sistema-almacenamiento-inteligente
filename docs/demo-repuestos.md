# Demo Repuestos

Empresa ficticia dedicada a repuestos, herramientas y materiales. Esta demostración permite aprender y probar el sistema con datos inventados. Los nombres, documentos, teléfonos, importes y operaciones no pertenecen a personas ni empresas reales.

## Abrir la demo en Windows

1. Copia los archivos de esta entrega sobre tu proyecto, conservando `.git`, `backend/.env`, tu entorno y los datos existentes.
2. Detén el servidor anterior con Ctrl+C para liberar el puerto 8000.
3. Desde la raíz del proyecto, ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

4. La primera vez elige y confirma una contraseña de entre 12 y 200 caracteres. No hay una contraseña predeterminada.
5. Abre `http://localhost:8000` e inicia con `propietario@demo-repuestos.example.com` y la contraseña elegida.

El script utiliza el entorno de `backend/.venv`, aplica migraciones y genera datos solo si la demo todavía no tiene usuarios. Si falta el entorno, ejecuta primero `scripts/setup.ps1`. La entrega incluye el frontend compilado. Después de editar React, ejecuta `npm run build` en `frontend`.

La base se guarda en `.demo/demo-repuestos.sqlite3` y las imágenes que subas en `.demo/imagenes`. Es SQLite para las pruebas locales; la instalación comercial sigue usando PostgreSQL. No cambia `backend/.env` ni `almacenamiento_db`. Las variables del script se restauran al terminar. No abras otra sesión simultánea usando el mismo puerto.

## Datos incluidos

| Elemento | Cantidad o contenido |
| --- | --- |
| Empresa | Demo Repuestos, PEN, America/Lima |
| Sedes | Arequipa y Juliaca |
| Almacenes | Tienda Arequipa, central Arequipa, tienda Juliaca |
| Productos | 80 SKU: 35 repuestos, 25 herramientas, 10 materiales y 10 pinturas |
| Atributos | Compatibilidad, medidas, potencia, longitud, diámetro, color y presentación |
| Variantes | 10 pinturas con color/presentación; 9 vinculadas al primer artículo como padre |
| Clientes / proveedores | 40 talleres y 10 distribuidores ficticios |
| Cuentas | Propietario y cinco roles de prueba |
| Historial | 180 días completos, más operaciones del día actual si son después de las 16:00 en Lima |
| Escenarios | Cobros completos/parciales, saldos, anulaciones sin cobro, transferencias, agotados y mínimos |

La generación es determinista para una fecha dada con semilla 20261010. El 10/10/2026 por la tarde produce 1.174 ventas, 92 compras, 1.029 pagos y 3.370 movimientos. Cada entrada/salida tiene saldo; las transferencias suman cero; las anulaciones restituyen unidades y no tienen cobros que requieran devolución ficticia. La cantidad varía según el calendario al generar otra demo.

Las miniaturas SVG son ilustraciones genéricas del rubro. Puedes reemplazarlas con imágenes JPG/PNG/WebP usando Editar → Agregar imagen.

## Cuentas y permisos

Todas parten de la contraseña que elegiste en la primera ejecución. Puedes cambiarla desde el perfil o mediante el propietario.

| Correo | Rol | Alcance |
| --- | --- | --- |
| propietario@demo-repuestos.example.com | Propietario | Toda la instalación, usuarios, roles y auditoría |
| admin@demo-repuestos.example.com | Administrador | Ambas sedes; operación y costos, sin administrar identidades |
| almacen@demo-repuestos.example.com | Almacenero | Arequipa; productos y movimientos, sin costos |
| ventas@demo-repuestos.example.com | Vendedor | Juliaca; ventas/cobros y contactos, sin costos ni anular |
| analista@demo-repuestos.example.com | Analista | Ambas sedes; reportes, pronósticos y asistente, sin costos |
| lector@demo-repuestos.example.com | Lector | Arequipa; consulta de productos/existencias |

## Pruebas recomendadas

| Caso | Acción | Resultado esperado |
| --- | --- | --- |
| Stock insuficiente | Vender 1 unidad de DR-080 desde Tienda Arequipa al iniciar la demo | Rechazo completo: ese saldo empieza en cero |
| Recepción | Recibir 20 unidades de DR-080 en esa tienda, con un proveedor demo | Stock 20, compra y movimiento registrados |
| Venta e impuesto | Vender 2 de DR-080 a S/ 96 y aplicar impuesto adicional 18% | Total S/ 226,56; stock 18 |
| Cobro parcial | Cobrar S/ 100 de esa venta | Pendiente S/ 126,56 |
| Anulación | Anular otra venta nueva sin cobros | Stock restituido y estado anulada |
| Transferencia | Mover 5 unidades del central a la tienda de Juliaca como propietario | Salida/entrada equilibradas; ambas sedes autorizadas |
| Restricción por sede | Entrar como vendedor | Solo almacén Juliaca; compras/costos no disponibles |
| Atributos | Editar una pintura o crear variante con un SKU nuevo | Color/presentación requeridos y tipo del padre respetado |
| Imágenes | Subir JPG/PNG/WebP menor a 5 MB y guardar | Vista previa y miniatura propia; SVG u otro archivo rechazado |
| Menú | Desplegar un grupo y contraer la barra; repetir en teléfono | Opciones visibles según permisos y cierre tras navegar |
| Excel | Descargar plantilla, completar SKU nuevo, prevalidar y confirmar | Errores por fila o importación del lote completo |
| Pronóstico | Calcular 14 días sobre todas las ventas | Historial suficiente y comparación de dos modelos |

Antes de repetir una operación que cambia datos, consulta su estado: las pruebas anteriores pueden haber modificado las cantidades iniciales.

DR-001 tiene una serie principalmente estable; DR-002 presenta crecimiento por tramos; DR-003 aumenta los sábados. También tienen ventas aleatorias adicionales y algunas anulaciones. Es una prueba del flujo y de evaluación temporal, no evidencia de precisión sobre demanda real. El pronóstico excluye hoy parcial. El asistente LLM sigue requiriendo modelo/proveedor configurado y no se simula como si estuviera conectado.

## Volver a tu instalación habitual

Detén la demo con Ctrl+C. En una terminal desde `backend`, inicia como antes:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Esto usa tu configuración habitual de PostgreSQL. El generador se niega a insertar en una base con empresa, usuarios, catálogo u operaciones existentes.

## Empezar una demo nueva

Detén el servidor y conserva la demo actual renombrando la carpeta; no se elimina:

```powershell
Rename-Item -Path .demo -NewName ('.demo-respaldo-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

La nueva demo pedirá otra contraseña. Si solo olvidaste la contraseña, puedes recuperarla con `app.cli reset-password` apuntando a esa base; no necesitas reiniciar los datos. Las carpetas `.demo*` deben permanecer fuera de Git.

## Variante con PostgreSQL

Para verificar el mismo dataset en el motor real, crea una base **vacía y separada** como administrador PostgreSQL:

```powershell
& 'D:\PostgreSQL\18.6\bin\psql.exe' -h localhost -p 5432 -U postgres -d postgres -c 'CREATE DATABASE demo_repuestos_db OWNER almacenamiento_app;'
```

En una terminal nueva, desde `backend`, usa temporalmente la base dedicada. La contraseña/host/usuario continúan viniendo de tu `.env`, sin necesidad de escribirlos dentro de una URL:

```powershell
$env:DB_NAME = 'demo_repuestos_db'
$env:APP_ENV = 'development'
$env:COOKIE_SECURE = 'false'
$env:DEMO_MODE = 'true'
$env:UPLOADS_DIR = Join-Path (Split-Path (Get-Location) -Parent) '.demo\imagenes-postgres'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.cli demo-repuestos
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Continúa al siguiente comando solo si el anterior termina correctamente. No ejecutes `init-owner` en esa base. Cierra esta terminal al terminar para descartar sus variables temporales. Si habías definido `DATABASE_URL` en `.env` o en esa terminal, esa URL tiene prioridad: retírala de la configuración de prueba antes de seguir para que `DB_NAME` seleccione la base dedicada. El comando se bloquea en producción y en nombres de base ajenos a la demo. Esta variante debe validarse en tu PostgreSQL local; no se ejecutó contra un servidor PostgreSQL real en la entrega.
