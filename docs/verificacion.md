# Verificación de la entrega v0.2.1

Fecha: 10/10/2026. Se verificó el código del paquete en este entorno, sin acceder a la base ni al equipo Windows del usuario. No se modificó GitHub ni se realizó publicación externa.

## Resultados

| Comprobación | Resultado | Alcance |
| --- | --- | --- |
| API `pytest -q` | 21 pruebas aprobadas | SQLite temporal; reglas de negocio y seguridad |
| Ruff | Sin errores | Backend, tests y scripts; imports locales de scripts exceptuados |
| Alembic | Upgrade y check correctos | Base SQLite temporal; datos iniciales de empresa/sedes/almacenes preservados |
| SQL PostgreSQL | Compilación offline correcta | Migraciones aditivas; no ejecutadas contra PostgreSQL real |
| `npm ci` | Correcto | Lock de dependencias incluido |
| `npm run lint` | Correcto | ESLint |
| `npm run format:check` | Correcto | Prettier |
| `npm run build` | Correcto | TypeScript y Vite, build incluido |
| Navegador escritorio | Correcto | Login → producto/imagen → entrada → venta → cobro → proveedor → recepción → pronóstico y menú desplegable |
| Navegación de módulos | Correcta | Pantallas principales sin errores de JavaScript |
| Móvil 390 × 844 | Correcto | Abrir menú, elegir pantalla, ocultar menú y sin desbordamiento global |
| Documento maestro | Renderizado y revisado | DOCX v0.2.1 con alcance, diseño y demo documentados |

## Casos de API

- Venta, pago parcial/total, PDF y anulación con restauración de stock.
- Rechazo/rollback completo ante un faltante en una venta de varias filas.
- Reenvío de venta/cobro/recepción sin duplicar efectos.
- Transferencia equilibrada y rollback ante destino inválido.
- Atributos tipados/requeridos y variantes.
- Restricción por sede y exclusión de costos en API/exportación.
- Sesión con zonas horarias distintas, expiración real, CSRF, cambio de contraseña y revocación; contraseña conserva espacios/comillas.
- Códigos duplicados e impuesto inválido.
- Excel, fórmulas rechazadas, estado inválido y lote atómico y valores numéricos de exportación utilizables en Excel.
- Recepción, costos históricos y consulta del detalle.
- Stock insuficiente y almacén inactivo.
- Pronóstico con datos insuficientes y comparación temporal usando historial ficticio de tests y Demo Repuestos.
- Asistente no configurado y proveedor simulado: herramientas permitidas y rechazo de argumentos no autorizados.

El framework emitió una advertencia de deprecación de TestClient/httpx; no fallaron las pruebas. Los tests usan credenciales sintéticas y una base desechable. No apuntar `TEST_DATABASE_URL` a una base real de negocio: las tablas de prueba se recrean.

## Comprobaciones pendientes en instalación real

1. En PostgreSQL: `alembic upgrade head`, `alembic current` y `alembic check`, tras respaldo y ensayo sobre copia.
2. Ejecutar suite con `TEST_DATABASE_URL` en una base exclusivamente de pruebas de PostgreSQL. El workflow incluido crea PostgreSQL 18 para ello; aún no se ejecutó en GitHub.
3. Probar concurrencia: dos ventas sobre el mismo saldo, primer movimiento simultáneo y transferencia entre sedes; verificar que no hay stock negativo ni movimientos duplicados.
4. Crear respaldo real y restaurarlo en base distinta/vacía. Revisar conteos, acceso y operaciones.
5. Ejecutar instalador en Windows/Python 3.14 del usuario; esta entrega se probó con Python 3.12 y Node 24 en Linux.
6. Construir/levantar Docker y comprobar TLS/dominio/cookie Secure. No se probaron contenedores ni hosting real.
7. Configurar LLM real y evaluar permisos, fuentes, precisión y latencia. La prueba simulada no acredita disponibilidad de un proveedor.
8. Aceptación del cliente: permisos/sedes, impuestos/precios, privacidad de datos y flujos propios del rubro.

El QR identifica por SKU, el PDF no es fiscal, Yape/Plin son registro manual y ML necesita historial. SUNAT, pasarela, RAG, lotes/series, reservas, caja y costeo avanzado permanecen fuera del alcance implementado; ver `requisitos.md`.

## Pruebas nuevas de la versión 0.2.1

- Base aislada: 80 productos, 50 contactos y 240 saldos; catálogo y variantes validados.
- Conciliación de cada saldo con el Kardex ordenado por fecha; ninguna existencia negativa; transferencias suman cero.
- Ventas y compras coinciden con líneas e importes; pagos coinciden con cobrado; anuladas sin cobro en la demo.
- Sedes y costos restringidos del vendedor; pronóstico con 180 días completos.
- Imagen: carga/lectura, formato válido, rechazo de SVG/archivo grande, reemplazo/limpieza, eliminación y permiso de edición.
- Agrupación diaria respeta timestamps con zona horaria.

El script PowerShell se revisó, pero no se ejecutó en Windows. Se ejecutaron su migración, generador y servidor equivalente en Linux. La cantidad de eventos ficticios depende de la fecha local al generar; el 10/10/2026 se obtuvieron 1.174 ventas, 92 compras, 1.029 pagos y 3.370 movimientos antes de las operaciones del navegador.
