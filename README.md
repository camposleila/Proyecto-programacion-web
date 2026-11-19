# Orígenes SV — Sistema de Gestión y Punto de Venta (POS)

Sistema web integral diseñado para administrar la operación comercial, inventario basado en recetas, turnos de caja, compras a proveedores y planilla quincenal de **Orígenes SV**. Desarrollado como proyecto de **Programación Web (Caso 1)** por un equipo de 8 integrantes dividido en 4 parejas (Backend + Frontend).

---

## Tabla de Contenidos

- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura y Estructura del Proyecto](#arquitectura-y-estructura-del-proyecto)
- [Requisitos Previos](#requisitos-previos)
- [Instalación y Configuración Local](#instalación-y-configuración-local)
- [Módulos y Roles del Sistema](#módulos-y-roles-del-sistema)
- [Reglas de API y Convenciones](#reglas-de-api-y-convenciones)
- [Flujo de Trabajo con Git](#flujo-de-trabajo-con-git)
- [Cronograma de Desarrollo](#cronograma-de-desarrollo)
- [Equipo de Desarrollo](#equipo-de-desarrollo)

---

## Stack Tecnológico

* **Frontend:** React.js + Vite
* **Backend:** Node.js + Express
* **Base de Datos:** PostgreSQL (driver `pg` con conversión automática de `NUMERIC` a número)
* **Autenticación y Seguridad:** JSON Web Tokens (`JWT`) + `bcryptjs`
* **Pruebas de API:** Postman (colecciones versionadas en `/postman`)

---

## Arquitectura y Estructura del Proyecto

El repositorio está modularizado por dominio para permitir el desarrollo paralelo entre parejas y evitar conflictos en archivos compartidos:

```text
origenes-sv/
├── backend/
│   ├── config/          # Configuración de conexión a BD (db.js)
│   ├── controllers/     # Lógica de negocio por módulo (ej. ventas.controller.js)
│   ├── datos_quemados/  # Datos JSON provisionales para desarrollo paralelo
│   ├── middleware/      # auth.js (JWT y roles) y errorHandler.js (manejo global)
│   ├── routes/          # Rutas por módulo y enrutador principal (index.js)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/  # Componentes reutilizables (tablas, modales, formularios)
│   │   ├── pages/       # Vistas por módulo
│   │   └── services/    # Cliente HTTP centralizado (api.js), servicios y mocks/
│   └── package.json
├── database/            # Scripts DDL, semillas y vistas (ej. vw_alertas_stock_minimo)

├── docs/                # Contratos de endpoints (API_CONTRATOS.md)
├── postman/             # Colección de peticiones para pruebas de integración
└── README.md

```

## Enlace a flujo de trabajo de trabajo 
[Enlace](https://mirror-tech-uca.atlassian.net/?continue=https%3A%2F%2Fmirror-tech-uca.atlassian.net%2Fwelcome%2Fsoftware%3FprojectId%3D10000&atlOrigin=eyJpIjoiMzA4MGZmYmNlNDJlNDBlYmI1MzNjYWQ2OTc0YjUwMmUiLCJwIjoiamlyYS1zb2Z0d2FyZSJ9)
