# Requisitos funcionales · v0.2.2

Fecha: 10/10/2026. Desarrolla el Documento Maestro v0.1 y registra el alcance real de la entrega. Una instalación tiene una empresa y su propia base; admite varias sedes y almacenes. No incluye suscripciones, planes ni gestión centralizada de clientes del proveedor.

## Estados

**Implementado**: código, interfaz y verificación del alcance indicado. **Parcial**: funciona una parte del requisito original; las extensiones figuran como pendientes. **Condicionado**: requiere configuración externa o historial. La evidencia está en [verificacion.md](verificacion.md); no sustituye la aceptación con PostgreSQL del cliente.

## Catálogo de requisitos

| ID | Disponible en v0.2.2 | Estado | Extensiones pendientes del v0.1 |
| --- | --- | --- | --- |
| F01 | Empresa única, RUC, moneda, zona horaria, sedes, almacenes y estados | Parcial | Logo configurable desde la interfaz, contacto de empresa, responsables, nomenclatura y parámetros generales de impuestos |
| F02 | Login/logout, sesiones, cambio de contraseña, alta/edición/bloqueo de usuarios, recuperación local | Parcial | Recuperación por correo, MFA, indicador dedicado del último acceso |
| F03 | Roles múltiples, acciones, protección de costos, alcance por sede, administración reservada | Parcial | Doble aprobación, alcance por almacén y otros permisos por campo |
| F04 | SKU único; filtros de precio/atributos/estado/stock; categorías; ficha, editor con vista previa, imágenes, archivo y borrado protegido | Parcial | Documentos adjuntos, etiquetas, edición/baja de categorías y filtros por proveedor |
| F05 | Tipos configurables; texto, número, fecha, booleano y selección; campos requeridos; variantes independientes | Parcial | Campos de archivo, series/activos, conversión de unidades y matriz masiva de variantes |
| F06 | Stock por almacén, entradas/salidas/ajustes/transferencias, saldo y Kardex, cantidades validadas | Parcial | Reservas, ubicaciones internas, devolución parcial, mermas separadas y conteo físico asistido |
| F07 | Plantilla XLSX/CSV, vista previa/error por fila, actualización por SKU, lote atómico y exportaciones | Parcial | Mapeo libre de columnas, importación de stock y filtros personalizados de exportación |
| F08 | QR PNG con SKU; búsqueda por SKU | Parcial | Cámara, hojas de etiquetas e integración con lectores |
| F09 | Clientes/proveedores, recepción completa, detalle/costos por recepción y stock | Parcial | Orden previa, recepción parcial, devolución al proveedor y costeo promedio/FIFO |
| F10 | Venta, descuento/impuesto, cobros parciales, saldo, medios de pago, anulación y PDF interno | Parcial | SUNAT, notas de crédito, conciliación automática, cierre de caja y devolución parcial |
| F11 | Alertas visuales de mínimo/agotado en existencias registradas | Parcial | Lotes, vencimientos, series, avisos externos y anomalías |
| F12 | Vista general, estadísticas de nueve módulos, período local, ranking/importes, valoración autorizada y exportación | Parcial | Comparativos avanzados, márgenes realizados e informes estadísticos PDF |
| F13 | Adaptador LLM con herramientas autorizadas de catálogo, stock y resumen | Condicionado | Activar/probar proveedor real, RAG, conversación persistente y evaluación de exactitud |
| F14 | Ridge de calendario versus base semanal, backtesting, MAE/WAPE, bandas y horizonte 1–30 días | Condicionado | 56 días completos reales; feriados/campañas, otros modelos, reposición e historial de ejecuciones |
| F15 | Argon2, cookie HttpOnly, CSRF, autorización, auditoría, controles Excel y scripts backup/restore | Parcial | Probar restauración PostgreSQL, retención/programación de respaldo y límites distribuidos de login |
| F16 | API /api/v1, OpenAPI, validación, filtros/paginación y pruebas | Implementado en alcance base | Autenticación futura app móvil/POS e integraciones externas |
| F17 | React responsive, texto legible, menú con control fijo, acciones con colores, estadísticas por sección, ficha en vivo y alertas con sonido opcional | Implementado en alcance base | Auditoría formal de accesibilidad, cámara y modo sin conexión |

## Reglas de negocio

1. Una empresa por instalación: `empresa.id = 1`. Otros clientes tienen otra instalación/base.
2. SKU único por producto o variante. La variante tiene padre del mismo tipo y un solo nivel; stock propio.
3. Stock solo mediante movimientos con delta, saldo, usuario, fecha, motivo y referencia.
4. Se rechaza stock negativo. La transferencia guarda origen y destino juntos o revierte todo.
5. Confirmar venta descuenta stock en una transacción. Abrir formulario no reserva stock. Una fila faltante revierte toda la venta.
6. Ventas, cobros y recepciones usan identificadores de petición para tolerar reenvíos. En movimientos manuales, consulta Kardex tras un error de red antes de repetir.
7. Descuento es el importe total de la fila. Impuesto es adicional al subtotal; no se asume precio con IGV incluido.
8. No se cobra más que el saldo. Yape/Plin/transferencia requieren referencia verificada manualmente; no hay confirmación bancaria automática.
9. Anular restaura toda la venta una vez. Conserva cobros; cualquier reembolso se concilia fuera del sistema.
10. Recepción guarda costos y suma stock; no cambia automáticamente el costo de valoración del producto.
11. Propietario tiene alcance global; otros usuarios operan solo en sedes asignadas. Cero sedes no significa acceso global. Catálogo y contactos son maestros compartidos.
12. Sin `costos.ver`, costos no salen por API/Excel. Consultar/recibir compras exige este permiso.
13. LLM usa restricciones del usuario, no SQL libre ni escrituras. Pregunta y resultados autorizados pueden enviarse al proveedor configurado.
14. Pronóstico usa ventas confirmadas, excluye hoy parcial y rellena días sin registros con cero. No representa demanda perdida ni efectivo cobrado.
15. Archivar maestros mantiene operaciones históricas. Auditoría global es exclusiva del propietario.

## Criterios de aceptación

| Flujo | Resultado | Error comprobable |
| --- | --- | --- |
| Tipo/producto | Atributos tipados; SKU localizable | Requerido ausente o SKU duplicado impide guardar |
| Salida | Saldo reducido y movimiento | Faltante produce 409 sin cambios |
| Transferencia | Dos movimientos relacionados; suma global conservada | Destino/alcance inválido revierte todo |
| Venta | Detalle/total y stock descontado | Faltante de una fila revierte todas |
| Cobro | Saldo reducido e historial | Sobrepago/referencia ausente se rechaza |
| Anulación | Stock restaurado, estado anulado | Repetir no duplica devolución |
| Recepción | Costos/stock guardados | Reenvío no duplica stock |
| Importación | Prevalidación y lote completo | Fila inválida impide aplicar el lote |
| Usuario restringido | Solo sedes asignadas; costos ausentes | Otro almacén devuelve 403 |
| IA/pronóstico | Resultados autorizados y métricas | Configuración/historial insuficiente se informa |

## Ejemplos por rubro

- **Bodega**: SKU por unidad/paquete, recepción, venta y cobro manual. Lotes/vencimientos no están implementados: v0.2.2 no proporciona trazabilidad sanitaria.
- **Ropa**: tipo con talla/color de selección, padre y SKU por variante; stock separado por combinación.
- **Ferretería**: unidad pieza/metro y hasta tres decimales, medidas/material y locales. Conversión caja–unidad pendiente; utiliza SKU independientes.
- **Maquinaria**: atributos de modelo/capacidad/fecha y cantidad. Serie individual, préstamo, mantenimiento y depreciación requieren extensión.

## Próximas prioridades

Antes de vender una instalación: aceptación en PostgreSQL, restauración comprobada, TLS/dominio y configuración de roles/impuestos. Integrar SUNAT si el cliente exige emisión fiscal. Elegir lotes/series, costeo, reservas o caja según el primer rubro. Activar/probar LLM con información autorizada y reunir historial real para pronósticos.

## Ampliación 0.2.1 conservada

Demo Repuestos permite probar datos ficticios en una base vacía y aislada. No sustituye la aceptación con PostgreSQL ni valida comercialmente un modelo ML. Se verifican saldos cronológicos, transferencias equilibradas, importes, pagos, atributos, alcance por sede y pronóstico. Fotos: JPG/PNG/WebP, 5 MB y 20 MP; conversión WebP hasta 1200 px; lectura/edición autorizada. Logo e ilustraciones genéricas se configuran en los assets de React; el editor de identidad visual desde la interfaz queda pendiente.

## Ampliación 0.2.2

- Nuevos/editar productos ocupan una página con ficha lateral en vivo. Ver producto consulta los datos guardados, imagen, atributos, QR y stock autorizado por almacén. El formulario no asigna existencias.
- Los filtros combinan tipo, categoría, marca, estado, precio mínimo/máximo, orden, stock/almacén y un campo dinámico del tipo elegido. Número admite límites; selección/fecha/booleano usan valores exactos; texto permite coincidencia parcial.
- Borrar exige `productos.eliminar` y confirmación del SKU. Solo se elimina un producto sin variantes hijas, registros de existencias ni historial de movimientos/venta/compra. Con historial se conserva y se archiva.
- Estadísticas cubre productos, inventario, ventas, compras, contactos, organización, usuarios, auditoría y Excel. Exige lectura del módulo y `reportes.ver`; costos y administración mantienen sus restricciones.
- Menú: Análisis (Vista general y Estadísticas primero), Administración y Operaciones. Contraer/expandir y sonido permanecen dentro del menú, fuera de su zona desplazable. Texto base 16 px y controles más grandes.
- Alertas de éxito/error tienen color y dos tonos breves distintos tras interacción. Se pueden silenciar; la preferencia se guarda por navegador. No sustituyen el mensaje visual.

IA y pronósticos no se amplían en esta entrega. Su activación y evaluación se trabajarán más adelante.
