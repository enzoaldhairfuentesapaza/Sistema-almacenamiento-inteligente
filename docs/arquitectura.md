# Arquitectura · v0.2.1

## Decisiones

Monolito modular: FastAPI, React + TypeScript + Vite y PostgreSQL por instalación. La web usa `/api/v1`; FastAPI también sirve el build de React. Vite usa proxy en desarrollo. Cada cliente tiene su propia instalación y base; no hay multiempresa en una base ni facturación SaaS.

## Componentes

| Componente | Responsabilidad | Ubicación |
| --- | --- | --- |
| React | Formularios, navegación, listados y visualización | `frontend/src` |
| API | Sesión, validación, autorización y transacciones | `backend/app/api/routes` |
| Servicios | Stock, atributos, serialización, análisis y ML | `backend/app/services` |
| SQLAlchemy | Integridad y datos históricos | `backend/app/models` |
| Alembic | Evolución ordenada de tablas | `backend/migrations` |
| LLM | Chat Completions con herramientas de consulta | `api/routes/inteligencia.py` |
| PDF/Excel/QR | Generación en memoria, sin almacenamiento de documentos | Rutas comercial/catalogo/excel |
| Operación | Instalación Windows, backup/restore y Docker opcional | `scripts`, `deployment` |

La migración `863dfa867d08` original se conserva. Las siguientes añaden tablas e índices sin recrear empresa/sedes/almacenes. `alembic upgrade head` actualiza la base. El arranque no ejecuta `create_all`.

## Modelo físico

| Grupo | Tablas y relación |
| --- | --- |
| Organización | `empresa` → `sedes` → `almacenes` |
| Seguridad | `usuarios`, `roles`, `sesiones`, `auditoria` |
| Catálogo | `tipos_producto.campos` JSON; categorías con padre; productos con atributos y producto padre |
| Inventario | `existencias` únicas producto/almacén; `movimientos` con delta y saldo |
| Comercial | `contactos`; `ventas` → `venta_detalles`/`pagos`; `compras` → `compra_detalles` |
| Importación | `importaciones` registra usuario, cantidad, fecha y vínculo de auditoría |

Roles y sedes del usuario son listas JSON de identificadores que la API valida. Una evolución con alcance por almacén/grupos complejos debería migrarlas a tablas de asociación. Los atributos se validan según el tipo sin crear columnas por cada cliente.

## Integridad del inventario

Se bloquean productos en orden de ID antes de bloquear/crear existencias. Esto también serializa el primer movimiento de un par producto–almacén. Se valida actividad/alcance, aplica delta y guarda Kardex en una transacción. Restricciones SQL evitan saldos negativos y pares duplicados.

Ventas de varias filas, transferencias y recepciones confirman todos sus cambios juntos. Importaciones revalidan cada fila al confirmar; un conflicto revierte todo. Ventas/cobros/recepciones tienen `request_id` único; un conflicto concurrente devuelve 409 sin duplicar efectos. SQLite de pruebas no reproduce los bloqueos de PostgreSQL; deben comprobarse con usuarios concurrentes en la instalación real.

Dinero usa Decimal y dos decimales; cantidad hasta tres. Venta conserva nombre/SKU/precio/costo del momento. Compra conserva costo/cantidad de recepción; nombres actuales se resuelven desde catálogo al consultar. Fechas en UTC; estadísticas agrupadas por zona horaria empresarial.

## Sesión y permisos

- Argon2; contraseña no normalizada ni guardada en texto.
- Sesión aleatoria opaca; hash en base; cookie HttpOnly/SameSite=Lax y expiración.
- CSRF + Origin en mutaciones. Producción exige cookie Secure y HTTPS en proxy.
- Permisos en cada ruta; alcance por sede en operaciones, estadísticas, exportaciones y LLM.
- Propietario administra usuarios/roles y auditoría global; no se escala mediante un rol.
- Cambiar contraseña o editar/bloquear usuario revoca sesiones. Permisos de roles se recalculan por petición.
- Intentos de login limitados en memoria por proceso; varios workers requieren límite compartido/proxy.

Costos se excluyen desde la API/Excel. Catálogo/contactos son globales de la empresa; operaciones tienen sede. Lectura y acción se asignan juntas para que la interfaz tenga selectores: venta necesita productos/sedes; compra también contactos; importación necesita gestionar productos.

## Inteligencia

LLM sin conexión SQL. Herramientas disponibles: buscar productos, consultar existencias y resumen, según permisos. Argumentos validados, pasos/resultados limitados. El proveedor recibe pregunta y resultados autorizados. Descripciones son datos, no instrucciones. No hay escritura ni RAG en v0.2.1.

Pronóstico compara base semanal con Ridge (tendencia, día de semana, ciclo anual). Dos cortes cronológicos de siete días entrenan solo con fechas anteriores. Selección por MAE; WAPE si hay denominador y banda del percentil 90 del error absoluto. Banda sin cobertura garantizada. Requiere 56 días completos, excluye hoy parcial, rellena ausencia con cero y no estima demanda perdida.

## Despliegue y personalización

Una instalación/imagen por cliente con su PostgreSQL/dominio/credenciales. `APP_ENV=production` bloquea SQLite y cookie insegura. Proxy TLS hacia backend; DB sin puerto público. Configuración y respaldos fuera de Git.

Personaliza empresa, tipos/campos y roles en UI. Mantén cambios de código por cliente en rama y documenta reglas. Las imágenes normalizadas ya usan almacenamiento separado y permisos. Los documentos adjuntos permanecen pendientes; las copias deben cubrir archivos y base.

## API y límites

Swagger `/docs`, API `/api/v1`. Listados con `limit/offset`; productos con búsqueda/filtros. UI: páginas de 50; selectores de ubicaciones/contactos hasta 1000; búsqueda de productos 20 resultados; exportación completa autorizada.

Errores: 401 sesión, 403 permiso/sede/CSRF, 404 inexistente, 409 conflicto, 422 validación/historial, 413 Excel grande, 502 proveedor fallido, 503 proveedor sin configurar. Conflictos SQL sanitizados, sin consultas ni credenciales en respuestas.

## Imágenes y demostración

`productos.imagen` guarda un nombre aleatorio; `UPLOADS_DIR` conserva el WebP normalizado fuera de las fuentes. Lectura protegida por `productos.ver`, subida/quitar por `productos.editar` y CSRF. Solo raster JPG/PNG/WebP; tamaños limitados, reducción a 1200 px y metadata eliminada. El nombre original no determina una ruta. Los assets SVG propios (logo, ilustraciones y miniaturas genéricas) son estáticos de React.

El generador `app/services/demo.py` inserta organización, cuentas, catálogo y seis meses de eventos ficticios en una transacción. Rechaza cualquier base con datos. `scripts/demo.ps1` cambia variables solo durante el proceso, apunta a SQLite aislada, aplica Alembic y pide contraseña mediante `getpass`. `DEMO_MODE` devuelve una marca de entorno en la sesión para mostrar el aviso de datos ficticios. Las pruebas comprueban saldos en orden de fecha, documentos, pagos, permisos y ML. El motor sigue siendo configurable; el comando también admite PostgreSQL dedicado `demo_repuestos_db`.
