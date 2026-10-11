"""Default installation roles (no owner-level identity permissions)."""

from app.core.security import PERMISSIONS

ROLE_CODES = {
    "Administrador": [k for k in PERMISSIONS if k != "auditoria.ver"],
    "Almacenero": [
        "empresa.ver",
        "sedes.ver",
        "productos.ver",
        "productos.editar",
        "inventario.ver",
        "inventario.mover",
        "inventario.ajustar",
        "excel.exportar",
    ],
    "Vendedor": [
        "empresa.ver",
        "sedes.ver",
        "productos.ver",
        "inventario.ver",
        "contactos.ver",
        "contactos.editar",
        "ventas.ver",
        "ventas.crear",
        "pagos.registrar",
    ],
    "Analista": [
        "empresa.ver",
        "sedes.ver",
        "productos.ver",
        "inventario.ver",
        "ventas.ver",
        "reportes.ver",
        "pronosticos.ver",
        "ia.usar",
        "excel.exportar",
    ],
    "Lector": ["empresa.ver", "sedes.ver", "productos.ver", "inventario.ver"],
}
