# Arquitectura del sistema

## Decisiones confirmadas

- Plantilla reutilizable con una instalación independiente por empresa.
- Cada empresa puede tener varias sedes y almacenes.
- Backend con FastAPI.
- Frontend con React, TypeScript y Vite.
- API versionada bajo /api/v1.
- Organización inicial como monolito modular.
- Autorización y reglas de negocio verificadas en el backend.

## Estructura actual

- backend/app/main.py: inicialización de FastAPI.
- backend/app/api/router.py: registro de rutas.
- backend/app/api/routes/: endpoints de la API.
- frontend/: aplicación web.
- docs/: documentación del proyecto.

## Estado verificado

- React funciona en desarrollo.
- FastAPI responde en /api/v1/health.
- React consulta FastAPI mediante el proxy de Vite.

## Pendientes

- Seleccionar la base de datos.
- Configurar acceso a datos y migraciones.
- Definir autenticación, permisos y alcance por sede.
- Diseñar los módulos del inventario.
- Definir el despliegue por cliente.
