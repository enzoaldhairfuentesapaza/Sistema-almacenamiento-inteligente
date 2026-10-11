# Instalación y desarrollo local

## Actualizar el proyecto existente

Detén FastAPI y React. Conserva tu carpeta del repositorio con `.git`, `backend/.env` y `.venv`. Extrae la entrega en una carpeta aparte y copia `backend`, `frontend`, `docs`, `scripts`, `deployment`, `.github`, `.gitignore`, `.dockerignore`, `README.md`, `LOCAL.md` y `DEPLOY.md` sobre el repositorio. No hay un `.env` real en el paquete; tu contraseña se conserva.

Tu PostgreSQL actual puede seguir en `D:\PostgreSQL\18.6`; no tienes que reinstalarlo ni borrar `almacenamiento_db`. Haz un respaldo antes de aplicar la actualización:

```powershell
cd "D:\ENZO\TEC COMPANY\Sistema-almacenamiento-inteligente"
.\backend\.venv\Scripts\python.exe scripts\backup.py --pg-bin "D:\PostgreSQL\18.6\bin"
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

`setup.ps1` instala dependencias, ejecuta `alembic upgrade head` y compila React. Detiene el proceso si un paso falla. La migración 0.1 permanece y las nuevas tablas se añaden sin borrar empresa, sedes o almacenes existentes.

## Cambios al actualizar a v0.2.2

No hay nuevas tablas en esta versión. Conserva los datos de la demo y el PostgreSQL habitual; copia también `frontend/dist` para ver la interfaz nueva si no compilas. El propietario tiene acceso al borrado protegido; para otros usuarios añade `productos.eliminar` al rol correspondiente. La actualización no sobrescribe permisos personalizados. Recarga la página después de reiniciar el servidor.

## Primera instalación

Necesitas Python 3.12 o superior, Node.js 24 o una versión compatible con el Vite instalado, npm, Git y PostgreSQL. La entrega se verificó con Python 3.12 y Node 24. En tu equipo se venía utilizando Python 3.14; instala las dependencias en su entorno y revisa el resultado del instalador.

Crea `almacenamiento_db`, propiedad de `almacenamiento_app`, como hicimos en la configuración inicial. Copia `backend/.env.example` a `backend/.env` y configura:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_NAME=almacenamiento_db
DB_USER=almacenamiento_app
DB_PASSWORD='tu contraseña real'
```

Si la contraseña contiene comillas simples, usa dobles externas y escapa las dobles internas con una barra inversa. No pegues los delimitadores Markdown en el archivo. `.env` no se sube a Git.

Ejecuta el instalador y crea el propietario desde `backend`:

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.cli init-owner
```

Este comando funciona una sola vez cuando aún no hay propietario. Solicita una contraseña de al menos 12 caracteres sin mostrarla. No hay credenciales predeterminadas ni una ruta pública para tomar control de la instalación.

## Arranque más sencillo

Desde `backend`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Abre `http://localhost:8000`, inicia sesión y entra en Empresa y sedes. El backend sirve el frontend previamente compilado. Al cambiar React, ejecuta `npm run build` desde `frontend` y recarga el navegador.

## Desarrollo con dos terminales

Primera terminal, desde `backend`, ejecuta Uvicorn. Segunda, desde `frontend`:

```powershell
npm ci
npm run dev
```

Abre `http://localhost:5173`. El proxy `/api` ya apunta a `http://127.0.0.1:8000`. Usa el mismo host en todas las páginas de la sesión; `localhost` y `127.0.0.1` tienen cookies separadas.

## Demo Repuestos aislada

Detén FastAPI para liberar el puerto 8000. Desde la raíz:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1
```

Si falta el entorno virtual, ejecuta `scripts\setup.ps1` primero. La entrega incluye React compilado. La primera vez el comando pide una contraseña de 12 a 200 caracteres y crea los datos; las siguientes veces reabre la misma demo conservando tus pruebas. Abre `http://localhost:8000`. Cuenta principal: `propietario@demo-repuestos.example.com`; usa la contraseña elegida. Los demás correos y escenarios están en `docs/demo-repuestos.md`.

Base SQLite separada en `.demo/demo-repuestos.sqlite3` e imágenes en `.demo/imagenes`. No modifica `.env` ni `almacenamiento_db`. SQLite sirve para explorar los flujos; la instalación del cliente sigue usando PostgreSQL. La variante PostgreSQL y cómo empezar otra demo están documentados en `docs/demo-repuestos.md`.

Para volver a la base habitual detén la demo con Ctrl+C y arranca FastAPI normalmente desde `backend`. Las variables temporales del script se restauran al salir. No ejecutes `init-owner` en la demo: ya incluye propietario.

El antiguo `seed-demo` permanece para un catálogo vacío con propietario creado; añade solo tres artículos, conserva la organización y se bloquea en producción.

## Recuperar acceso

El propietario puede cambiar la contraseña de un usuario desde Usuarios y roles. Si el propietario pierde acceso, el responsable con acceso al servidor ejecuta:

```powershell
.\.venv\Scripts\python.exe -m app.cli reset-password --email tu-correo@ejemplo.com
```

El comando revoca todas las sesiones del usuario. La recuperación automática por correo está pendiente.

## LLM

Configura en `backend/.env` un proveedor que admita Chat Completions y llamadas a funciones:

```dotenv
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY='clave del proveedor'
LLM_MODEL=nombre-del-modelo-con-herramientas
```

También admite un endpoint local compatible. Reinicia FastAPI. Sin `LLM_MODEL` devuelve un mensaje explícito de no configuración. Cada petición envía la pregunta y solo los resultados autorizados de las herramientas; la configuración y los secretos no se incluyen. Se necesita conectividad al proveedor. No se ha verificado una llamada real a un proveedor en esta entrega porque no se suministró una clave.

## Verificar y guardar en Git

```powershell
# Desde backend
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app tests
# Desde frontend
npm run lint
npm run build
# Desde la raíz
 git check-ignore backend/.env
 git ls-files backend/.env
 git status
 git add backend frontend docs scripts deployment .github .gitignore .dockerignore README.md LOCAL.md DEPLOY.md
 git diff --cached --stat
 git commit -m "Agrega Demo Repuestos y mejora interfaz v0.2.1"
 git push origin main
```

`git ls-files backend/.env` debe estar vacío. Si estaba registrado previamente, utiliza `git rm --cached backend/.env` antes de guardar. Revisa el diff y no incluyas contraseñas ni respaldos.

## Problemas frecuentes

- 401: vuelve a iniciar sesión; la cookie expiró o cambió la contraseña.
- 403 al guardar: faltan permisos, sede o token CSRF. Recarga para renovar el estado de sesión.
- 409 en movimientos: revisa stock disponible, códigos duplicados o ubicaciones inactivas.
- 422 al guardar: valida los campos obligatorios y los atributos del tipo.
- Error de `.env`: revisa comillas y nombre `DB_PASSWORD`; conserva la contraseña completa.
- Puerto 8000 ocupado: detén el servidor anterior antes de arrancar el nuevo.
- Swagger puede requerir iniciar sesión desde React en el mismo host. Para mutaciones incluye `X-CSRF-Token`; la interfaz ya lo hace.

## Imágenes del catálogo

En Productos → Nuevo producto o Editar, pulsa **Agregar imagen**, elige JPG/PNG/WebP de hasta 5 MB y guarda. Se muestra vista previa; la imagen se normaliza a WebP con un máximo de 1200 px. Se admiten hasta 20 megapíxeles. Las ilustraciones genéricas de herramientas/repuestos son referencias visuales, no fotografías del artículo.

La API exige `productos.ver` para leer y `productos.editar` para subir/quitar. Los originales no se sirven y la metadata no se conserva. Los archivos se guardan en `backend/var/uploads`, o en `UPLOADS_DIR` si se configura. Respalda esa carpeta junto con PostgreSQL: `backup.py` solo respalda la base. En Docker se usa el volumen `catalog_images`. El guardado de datos y la subida de imagen son dos solicitudes: si la segunda falla, la interfaz informa que el producto ya quedó guardado y permite reintentar desde Editar.
