# Pantallas y permisos · v0.2.2

API como autoridad. Menús/botones se adaptan; llamadas directas reciben la misma validación. Los roles suman permisos; no hay herencia ni denegaciones explícitas. Propietario tiene alcance completo y acciones reservadas.

## Pantallas

| Pantalla | Lectura | Acción adicional |
| --- | --- | --- |
| Acceso/perfil | Sesión propia | Login/logout/cambio de contraseña |
| Vista general | `reportes.ver` | Valoración: `costos.ver` |
| Estadísticas global/local | `reportes.ver` + lectura de cada módulo | Compras/valoración: `costos.ver`; usuarios/auditoría: propietario; Excel: permiso de importar/exportar y solo eventos propios |
| Productos | `productos.ver` | Crear/editar/archivar/tipos/categorías: `productos.editar`; costos: `costos.ver`; QR/ficha con lectura; borrar sin historial: `productos.eliminar` |
| Inventario/Kardex | `inventario.ver` | Entrada/salida: `inventario.mover`; ajuste/transferencia además `inventario.ajustar` |
| Ventas/cobros | `ventas.ver` | Crear: `ventas.crear`; cobrar: `pagos.registrar`; anular: `ventas.anular` |
| Compras | `compras.ver` + `costos.ver` | Recibir: `compras.crear` + `costos.ver` |
| Contactos | `contactos.ver` | Crear/editar/inactivar: `contactos.editar` |
| Empresa/sedes | `empresa.ver`, `sedes.ver` | Empresa: `empresa.editar`; sedes/almacenes: `sedes.editar`; nueva sede: propietario |
| Excel | `excel.importar` o `excel.exportar` | Importación además `productos.editar`; exportación además lectura del módulo; costos según permiso |
| Asistente y pronósticos | `ia.usar` o `pronosticos.ver` | Herramientas según lectura; pronóstico además `reportes.ver` |
| Usuarios/roles | Propietario | Alta/edición/bloqueo, roles, sedes y contraseña |
| Auditoría | Propietario | Consulta global; sin editar/borrar eventos por API |

## Roles iniciales

Creados por `init-owner`. Son configurables; propietario es atributo reservado de cuenta.

| Rol | Permisos iniciales | Alcance |
| --- | --- | --- |
| Propietario | Todo + usuarios/roles/auditoría | Toda la instalación |
| Administrador | Códigos operativos excepto auditoría; no administra identidades | Sedes asignadas |
| Almacenero | Lectura empresa/sedes/productos/inventario; edición catálogo; movimientos/ajustes/transferencias; exportar | Sedes asignadas; sin costos |
| Vendedor | Lectura empresa/sedes/productos/inventario/contactos/ventas; edición contactos; crear venta/cobrar | Sedes asignadas; sin costos/anulación |
| Analista | Lectura empresa/sedes/productos/inventario/ventas; reportes/ML/IA/exportar | Sedes asignadas; sin costos ni edición |
| Lector | Lectura empresa/sedes/productos/inventario | Sedes asignadas |

Cero sedes implica cero alcance operativo. Catálogo/contactos se consultan con su permiso. Administrador no significa global ni administrador de identidades.

## Configurar un rol

- Asigna lectura y acción juntas para usar el flujo en la web.
- Venta/compra/movimiento necesitan `sedes.ver` y `productos.ver`; compra también `contactos.ver`.
- Importación necesita `productos.editar`; costo necesita `costos.ver`.
- `auditoria.ver` aparece como código, pero la ruta global siempre exige propietario.
- El rol no asigna sedes: se configuran en cada usuario.
- Operadores no cambian roles/sedes propios. Propietario cambia contraseña desde perfil o comando local.

## Estados y confirmaciones

Formularios con validación, espera y botón bloqueado al guardar. Archivo solicita confirmación; anulación exige motivo. Diálogos con etiquetas, foco nativo y Escape. Tablas con vacío/carga/error y paginación. Stock nunca se introduce desde producto.

## Navegación y estadísticas de la versión 0.2.2

Análisis aparece primero (Vista general y Estadísticas al inicio), luego Administración y finalmente Operaciones. El control de tamaño y sonido está dentro de la barra y no se desplaza con las opciones. Cada sección tiene un icono/acento y las subsecciones una selección visible.

Los productos se crean/editan en página con ficha en vivo. Ver ficha usa lectura; editar usa gestión; borrar tiene permiso independiente y exige SKU. El backend impide borrar registros vinculados, aunque el botón esté disponible. El propietario tiene el permiso nuevo automáticamente. Los roles existentes conservan sus asignaciones; el propietario puede añadir `productos.eliminar` desde Usuarios y roles. Roles Administrador creados después de esta versión lo incluyen; Almacenero no lo recibe por editar catálogo.

`/reportes/modulos/{modulo}` valida `reportes.ver` y lectura: productos, inventario, ventas, compras+costos, contactos, sedes para organización, propietario para accesos/auditoría y permiso Excel para su resumen propio. Operaciones/ubicaciones se limitan a sedes del usuario. La página global solo reúne módulos autorizados.
