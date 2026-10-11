# Historial de cambios

## v0.2.1 · 10/10/2026

- Empresa ficticia Demo Repuestos y generador aislado: 80 productos, 40 clientes, 10 proveedores, 2 sedes, 3 almacenes y 6 cuentas.
- 180 días completos de ventas/compras/cobros/Kardex con series estables, tendencia y mayor actividad los sábados; casos de bajo stock y anulación.
- Paleta amarillo/negro, logo e ilustraciones SVG propios, miniaturas genéricas, menú por grupos y barra contraíble.
- Formularios con ayudas, campos requeridos, disponibilidad consultada, totales claros y archivo con vista previa.
- Fotografías del catálogo con API autorizada, normalización WebP y migración aditiva `ae2809d10001`.
- 21 pruebas de API aprobadas; documentación y manual actualizados. Verificación PostgreSQL/Windows/Docker pendiente en el equipo/servidor real.
- Búsqueda en inventario/Kardex, operaciones y contactos; auditoría con nombre de usuario.

## 0.2 · 09/10/2026

Entrega funcional amplia sobre el repositorio recibido. FastAPI modular con sesiones, CSRF, roles/sedes/costos, catálogo dinámico y variantes, movimientos atómicos, ventas/cobros/anulación/PDF, recepciones, contactos, Excel, QR, dashboard, adaptador LLM y comparación temporal de pronósticos. React responsive con formularios, búsqueda, paginación y mensajes.

Conserva migración original y añade dos revisiones de tablas/índices. Incluye pruebas de API, configuración de CI PostgreSQL, instalador PowerShell, scripts de respaldo/restauración, Docker opcional, documento maestro v0.2 y manual. Evidencia y límites en `verificacion.md`; estados F01–F17 en `requisitos.md`.

Pendientes de integración: SUNAT, pasarela/conciliación, RAG y proveedor LLM real; ampliaciones de lotes/series, caja, reservas y costeo. No se declara terminado todo el alcance original ni un despliegue comercial validado.

## 0.1 · 08/10/2026

Documento maestro inicial. Define instalaciones independientes, múltiples sedes, inventario, ventas, Excel, QR, roles, LLM, ML y manual evolutivo. Base inicial React/FastAPI y primera migración de empresa/sedes/almacenes validada en el equipo del usuario.
