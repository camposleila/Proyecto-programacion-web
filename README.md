# Restaurante Orígenes SV: ERP y POS

Proyecto de Programación Web 2026 (Caso 1). Stack: **Node.js + Express** (backend), **React** (frontend) y **PostgreSQL** (base de datos, en Docker).

## Estructura

```
Proyecto-programacion-web/
├── backend/
│   ├── config/           conexión a PostgreSQL (Pool de pg) y lectura del .env
│   ├── controllers/      lógica de cada endpoint
│   ├── datos_quemados/   datos de ejemplo (JSON) para avanzar sin base de datos
│   ├── middleware/       manejo de errores, autenticación, roles
│   ├── routes/           rutas de la API (una por módulo)
│   ├── scripts/          setup-db.js (crea la base, tablas y semilla)
│   ├── tests/
│   ├── app.js            configuración de Express
│   └── server.js         arranque del servidor
├── database/             scripts SQL (esquema y datos semilla)
├── docs/                 documentación (guía de arranque, etc.)
├── frontend/src/         assets, components, services (api.js)
├── postman/              colección de pruebas de la API
├── docker-compose.yml    PostgreSQL del proyecto
└── .env.example          variables de entorno (copiar como .env)
```

## Arranque rápido

```bash
copy .env.example .env      # Mac/Linux: cp .env.example .env
docker compose up -d        # levanta PostgreSQL (puerto 5433)
cd backend
npm install
npm run db:setup            # crea usuario, base, tablas y semilla
npm run dev
```

Prueba: `http://localhost:3000/api/health`

Guía completa y solución de problemas: [docs/GUIA_EQUIPO.md](docs/GUIA_EQUIPO.md)

## Reglas del equipo

- Una rama por módulo (`feature/ventas`, `feature/inventario`, ...) y pull request revisado por Backend 1.
- Cada módulo tiene sus propios archivos de rutas y controladores (`ventas.routes.js`, `ventas.controller.js`).
- Tablas y columnas en `snake_case` y minúsculas, tal como están en `database/01_schema.sql`.
- Consultas siempre con parámetros (`$1, $2`), nunca concatenando texto.
- Ventas, compras y planillas usan `withTransaction`.
- Formato de respuesta: `{ ok: true, ... }` en éxito y `{ ok: false, mensaje }` en error.
- Nunca subir el `.env` a GitHub.
