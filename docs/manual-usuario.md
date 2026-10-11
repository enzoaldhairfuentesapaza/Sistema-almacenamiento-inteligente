# Manual de usuario · v0.2.1

Sistema de Almacenamiento Inteligente. Fecha: 10/10/2026. Describe las funciones disponibles y verificadas; las integraciones pendientes no se presentan como disponibles. Incluye el entorno ficticio Demo Repuestos.

## 1. Acceder y cambiar contraseña

**Objetivo:** acceder al espacio de la empresa y proteger tu cuenta. **Requisitos:** propietario creado por instalación o usuario activo creado por él. **Versión:** 0.2.1.

1. Abre la URL de la instalación (en local, `http://localhost:8000`).
2. Escribe correo y contraseña; pulsa **Entrar a mi espacio**.
3. Usa el menú lateral. Pulsa **Operación**, **Análisis** o **Administración** para desplegar sus opciones. En computadora, el botón de menú contrae/expande la barra. En teléfono abre el menú y elige una pantalla; se cierra al navegar.
4. Para cambiar contraseña pulsa tu nombre/inicial en la cabecera. Escribe la contraseña actual y la nueva de al menos 12 caracteres; repítela.
5. Tras guardar inicia sesión de nuevo. Para salir pulsa **Salir**.

**Resultado:** sesión activa con menús según permisos; el cambio de contraseña cierra todas tus sesiones. **Problemas frecuentes:** correo/contraseña incorrectos, cuenta bloqueada o sesión vencida. El propietario puede restablecer un usuario; si pierde su propio acceso usa el procedimiento local de `LOCAL.md`. La recuperación automática por correo no está disponible.


## 2. Configurar empresa, sedes y almacenes

**Objetivo:** establecer identidad y ubicaciones. **Requisitos:** lectura de empresa/sedes; editar empresa y sedes para cambios. Crear una sede requiere propietario. **Versión:** 0.2.1.

1. Abre **Empresa y sedes** y guarda razón social, nombre comercial, RUC opcional, moneda y zona horaria.
2. En sedes pulsa **Nueva sede**; introduce código, nombre y dirección. Guarda.
3. En almacenes pulsa **Nuevo almacén**, selecciona sede, código y nombre. Guarda.
4. Edita datos o cambia el estado cuando una ubicación deje de operar.

**Resultado:** ubicaciones seleccionables en los movimientos y operaciones. **Problemas frecuentes:** código duplicado o sede inexistente/inactiva. No se traslada un almacén existente a otra sede y no se cambia moneda después de registrar ventas o compras. Los movimientos históricos se conservan al inactivar una ubicación.


## 3. Crear tipos, productos y variantes

**Objetivo:** adaptar el catálogo al rubro. **Requisitos:** `productos.ver` y `productos.editar`; para costo, `costos.ver`. **Versión:** 0.2.1.

1. En **Productos → Tipos y campos** crea un tipo como Ropa o Repuesto.
2. Agrega clave sin espacios, etiqueta y tipo de cada campo: texto, número, fecha, booleano o selección. Para selección escribe las opciones separadas por coma. Marca los requeridos.
3. Crea categorías en la pestaña **Categorías**; opcionalmente elige categoría padre.
4. En **Productos** pulsa **Nuevo producto**. Completa SKU único, nombre, unidad, tipo, categoría, precio, mínimo y atributos. Precio es antes del impuesto adicional de venta.
5. Para una variante, selecciona un producto padre; usa otro SKU y valores propios (por ejemplo talla/color). Debe compartir el tipo del padre.
6. Opcionalmente pulsa **Agregar imagen**, elige JPG/PNG/WebP de hasta 5 MB y revisa la vista previa. Guarda. Busca por nombre, SKU o marca y usa **Editar**, **Archivar/Activar** o **QR**.

**Resultado:** producto independiente y disponible para registrar existencias; el formulario no asigna stock. **Problemas frecuentes:** SKU duplicado, campo requerido vacío, opción desconocida o padre de otro tipo. Los tipos utilizados no cambian su definición de campos en v0.2.1. Las categorías se crean, pero su edición/baja queda pendiente. Archivar impide nuevas operaciones y conserva historial.


## 4. Entradas, salidas, ajustes y transferencias

**Objetivo:** mantener existencias con historial. **Requisitos:** inventario/productos/sedes visibles y `inventario.mover`; ajuste/transferencia además `inventario.ajustar`. Acceso a las sedes involucradas. **Versión:** 0.2.1.

1. Abre **Inventario**; alterna **Existencias** y **Kardex**. Filtra por almacén.
2. Pulsa **Registrar movimiento**; busca y selecciona un producto.
3. Elige entrada/salida/ajuste/transferencia y almacén de ingreso para entrada, o de origen para salida/transferencia.
4. Introduce cantidad positiva y motivo. Para ajuste indica sumar/restar; para transferencia elige otro destino.
5. Confirma una vez y consulta el saldo/Kardex.

**Resultado:** movimiento con saldo nuevo; transferencia produce una salida y una entrada relacionadas. **Problemas frecuentes:** salida mayor que el stock, misma ubicación de origen/destino, sede inactiva o falta de permiso. Se revierte la operación completa. Si hay error de red después de confirmar, revisa Kardex antes de reenviar un movimiento manual.

El ajuste modifica una diferencia, no fija el saldo final. Si hay 10 y el conteo es 8, registra ajuste **restar 2**. Cada SKU/almacén tiene su saldo. Para devoluciones o mermas manuales usa entrada/salida con motivo; no existe un proceso parcial vinculado a venta.


## 5. Clientes, proveedores y recepciones

**Objetivo:** conservar contactos y registrar compras recibidas. **Requisitos:** lectura/edición de contactos; para recepción `compras.crear`, lectura de catálogo/sedes/contactos y `costos.ver`. Para consulta `compras.ver` + costos. **Versión:** 0.2.1.

1. En **Contactos** elige **Clientes** o **Proveedores** y pulsa **Nuevo contacto**. Guarda nombre y datos opcionales.
2. En **Compras** pulsa **Recibir compra**. Elige almacén y proveedor activo.
3. Busca productos y completa cantidad/costo unitario de cada fila. Introduce referencia de recepción.
4. Revisa total y confirma recepción.
5. Abre **Ver detalle** para consultar cantidades y costos recibidos.

**Resultado:** compra completa y entradas en Kardex. **Problemas frecuentes:** proveedor inactivo, falta de costos o sede fuera del alcance. Recepción es completa; no hay orden previa ni recepción parcial. El costo histórico se guarda en compra; el costo de valoración del catálogo se edita por separado. No se calculan FIFO/promedio automáticamente.


## 6. Ventas, cobros y constancias

**Objetivo:** vender, controlar pendientes y dejar constancia. **Requisitos:** lectura de ventas/productos/sedes y `ventas.crear`; cobrar requiere `pagos.registrar`. **Versión:** 0.2.1.

1. Abre **Ventas y cobros → Nueva venta**. Elige almacén y cliente opcional.
2. Busca productos, añade cantidades, precio y descuento total de fila.
3. Si corresponde, introduce impuesto adicional porcentual. El importe base no se interpreta como precio con impuesto incluido.
4. Revisa el total y pulsa **Confirmar venta**. Aquí se descuenta stock; el cobro se registra después.
5. Abre **Ver detalle → Registrar cobro**. Introduce monto recibido y medio. Para Yape/Plin/transferencia agrega referencia tras verificar el ingreso.
6. Confirma cobro y consulta saldo. Se permiten varios cobros parciales hasta el total.
7. En detalle descarga **Constancia PDF**.

**Resultado:** venta confirmada, stock reducido y saldo actualizado por cobros. **Problemas frecuentes:** falta de stock en cualquier fila revierte toda la venta; descuento superior al importe se rechaza; no se admite sobrepago. No se registra cobro al mostrar un QR.

La constancia es **documento interno sin validez tributaria**. SUNAT, series fiscales, notas de crédito y confirmación bancaria automática siguen pendientes. Ventas registradas, cobros y utilidad son magnitudes distintas.


## 7. Anular una venta

**Objetivo:** revertir una venta completa conservando su historia. **Requisitos:** `ventas.ver`, `ventas.anular` y acceso a la sede. **Versión:** 0.2.1.

1. Localiza la venta y abre **Ver detalle → Anular venta**.
2. Escribe motivo y revisa la advertencia sobre cobros existentes.
3. Confirma. Consulta estado y Kardex.

**Resultado:** venta anulada y cantidades restituidas una sola vez. Cobros históricos no se borran. **Problemas frecuentes:** falta de permiso/sede. Si ya hubo cobros, concilia el reembolso fuera de la aplicación; el sistema no devuelve dinero. No se implementan devoluciones parciales ni notas de crédito. Captura de ubicación del flujo: sección anterior.

## 8. Importar y exportar Excel/CSV

**Objetivo:** cargar catálogo de forma controlada y extraer información autorizada. **Requisitos:** `excel.importar` + `productos.editar`; costos además `costos.ver`. Exportar requiere `excel.exportar` y lectura del módulo. **Versión:** 0.2.1.

1. Abre **Importar / exportar** y descarga la plantilla.
2. Completa filas con encabezados de plantilla; SKU y nombre son obligatorios. No uses fórmulas. Conserva el SKU como texto.
3. Para referencias de tipo/categoría/variante y atributos, configura un producto en UI y usa su exportación como referencia. Atributos se expresan como JSON, por ejemplo `{"talla":"M"}`. Deja referencias vacías si no se usan.
4. Una fila representa el producto completo: las columnas omitidas usan sus valores por defecto; revisa precio/estado/atributos antes de actualizar un SKU existente. Costo omitido se conserva al actualizar. Stock no se importa aquí.
5. Selecciona XLSX o CSV UTF-8 y pulsa **Prevalidar**. Revisa los errores de cada fila; corrige el archivo y repite si los hay.
6. Con todas las filas válidas pulsa **Confirmar importación**. Se aplica todo el lote; un conflicto lo revierte.
7. Para exportar selecciona productos, existencias, movimientos o ventas. Se descargan todos los datos autorizados, no solo la página visible.

**Resultado:** catálogo actualizado por SKU y evento de importación/auditoría. **Problemas frecuentes:** duplicados, columnas ajenas, referencias inexistentes, JSON inválido, archivos mayores de 5 MB o más de 1000 filas. Usa encabezados exactos: el mapeo libre de columnas no está disponible. QR se descarga desde cada producto y contiene solo su SKU; no hay cámara ni plancha de etiquetas.


## 9. Vista general, asistente y pronósticos

**Objetivo:** revisar actividad y consultar datos autorizados. **Requisitos:** `reportes.ver`; valoración requiere costos; IA `ia.usar` y permisos de lectura para sus herramientas; pronóstico `pronosticos.ver` + reportes. **Versión:** 0.2.1.

1. En **Vista general** consulta ventas de hoy, pendiente de cobro, ranking, evolución y mínimos. Los mínimos se calculan sobre registros existentes de stock; un producto sin movimientos aún no tiene registro por almacén.
2. En **Inteligencia → Asistente** escribe una pregunta concreta: SKU/producto y almacén cuando corresponda. Envía y revisa respuesta y fuentes.
3. Si aparece proveedor no configurado, el responsable debe completar LLM en `.env`; no hay respuestas simuladas de inventario.
4. En pronósticos elige horizonte (7/14/30 días) y producto opcional. Sin producto predice importe de ventas; con producto, unidades vendidas.
5. Calcula y revisa historial, modelos comparados, MAE/WAPE y bandas de error.

**Resultado:** análisis del alcance autorizado. **Problemas frecuentes:** historial inferior a 56 días completos, falta de ventas/modelo/permiso o fallo del proveedor. Los días sin registro se consideran cero; se excluye hoy parcial. El pronóstico comienza desde hoy y no estima demanda perdida por agotamiento. Las bandas son empíricas sin cobertura garantizada. La IA no modifica datos ni responde sobre documentos PDF mediante RAG en v0.2.1. La conexión a proveedor real debe validarse antes de uso comercial.



## 10. Usuarios, roles y auditoría

**Objetivo:** delegar operaciones con alcance explícito. **Requisitos:** propietario. **Versión:** 0.2.1.

1. En **Usuarios y roles** consulta los roles iniciales o crea uno con las acciones necesarias.
2. Crea usuario con nombre, correo, contraseña mínima de 12 caracteres, roles y sedes.
3. Asigna tanto lectura como acción para que el flujo tenga los selectores requeridos. Sin sedes no ve operaciones; Administrador no da alcance global.
4. Edita/bloquea/restablece contraseña cuando corresponda. Editar el usuario cierra sus sesiones.
5. En **Auditoría** revisa usuario, fecha, acción y entidad de los eventos. Solo lectura.

**Resultado:** menús y respuestas autorizados, con costos protegidos. **Problemas frecuentes:** rol inexistente, correo duplicado, falta de sedes o lectura. Roles se suman. El propietario no se edita mediante esta pantalla. El catálogo y contactos son compartidos de la empresa. Matriz exacta en `pantallas-permisos.md`.


## 11. Respaldo y recuperación

**Objetivo:** proteger la instalación y verificar una copia. **Requisitos:** responsable con acceso al servidor, PostgreSQL y `.env`; es una operación local, sin pantalla web. **Versión:** scripts incluidos en 0.2; ejecución PostgreSQL pendiente de aceptación.

1. Sigue `DEPLOY.md` para ejecutar `scripts/backup.py`; guarda el archivo fuera del equipo principal.
2. Crea una base distinta y vacía. Usa `scripts/restore.py` sobre ella.
3. Comprueba tablas, conteos, login y operaciones antes de utilizar una base restaurada.

**Resultado esperado:** archivo de respaldo y copia verificable. **Problemas frecuentes:** ruta de `pg_dump`, permisos o destino con tablas. Restore rechaza base principal y destino no vacío. La restauración real debe probarse en tu equipo; aquí no se verificó PostgreSQL. Nunca publiques `.env`, bases o respaldos en Git.

## Búsqueda rápida

En Inventario y Kardex busca por nombre o SKU. En Ventas busca por número (por ejemplo VE-000010), cliente o almacén. En Compras busca por número, proveedor, almacén o referencia. En Contactos busca por nombre, documento o correo. Los filtros conservan tus permisos y sedes asignadas.

## Errores comunes

| Mensaje/estado | Acción |
| --- | --- |
| Sesión vencida (401) | Inicia sesión otra vez |
| Sin permiso/alcance (403) | Revisa rol y sedes con propietario |
| CSRF inválido (403) | Recarga o vuelve a iniciar sesión |
| Conflicto (409) | Revisa duplicados, estado y stock; consulta historial antes de repetir |
| Validación (422) | Revisa campos, cantidades y atributos; ML necesita historial |
| Archivo grande (413) | Divide en lotes de hasta 1000 filas/5 MB |
| IA no configurada (503) | Configura proveedor/modelo; no es un fallo del inventario |
| Proveedor fallido (502) | Revisa conexión/configuración del proveedor |

En móvil abre el menú desde la cabecera. Puedes cerrarlo con la ×, pulsando el fondo o eligiendo una pantalla. Las tablas permiten desplazamiento horizontal.

## 12. Explorar Demo Repuestos

**Objetivo:** aprender los flujos con una empresa ficticia. **Requisitos:** ejecutar `scripts/demo.ps1` desde la raíz y elegir una contraseña. **Versión:** 0.2.1.

1. Inicia como `propietario@demo-repuestos.example.com`. El aviso amarillo confirma que son datos ficticios.
2. Revisa Vista general: ventas, saldo pendiente, ranking y alertas.
3. En Productos busca un filtro o pintura; abre Editar y revisa atributos, variante e imagen opcional.
4. En Inventario consulta almacenes e Historial/Kardex. Registra una transferencia entre ubicaciones autorizadas.
5. Crea una venta de un producto con stock, añade un cobro parcial y verifica el saldo en su detalle.
6. En **Asistente y pronósticos → Pronósticos**, calcula 14 días. Puedes elegir un producto o todas las ventas. El asistente LLM necesita configuración propia.
7. Sal y entra con `ventas@demo-repuestos.example.com` para ver solo Juliaca y los permisos de vendedor. Todos los usuarios ficticios parten de la contraseña elegida al crear la demo.

**Resultado:** operaciones sobre datos de prueba sin alterar PostgreSQL habitual. **Problemas frecuentes:** puerto ocupado por el servidor anterior, contraseña olvidada o falta de sede/permiso según cuenta. Cómo reiniciar y matriz de usuarios en [demo-repuestos.md](demo-repuestos.md). Los resultados ML sobre datos inventados solo demuestran el funcionamiento del flujo.
