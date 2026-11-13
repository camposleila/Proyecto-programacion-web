# Guía de arranque para el equipo (Orígenes SV)

Usamos **PostgreSQL en un contenedor de Docker propio del proyecto** (`origenes-postgres`). Todos usamos la misma configuración, así que no hay que editar nada. Tiempo estimado: 5 minutos.

## Requisitos

- **Docker Desktop** abierto y corriendo
- **Node.js** versión LTS, **Git** y **VS Code**
- DBeaver (o el cliente que uses) solo si quieres ver las tablas

## Pasos

**1. Clonar el repositorio y crear tu `.env`**

```bash
git clone <URL-del-repo>
cd Proyecto-programacion-web
copy .env.example .env        # en Mac/Linux: cp .env.example .env
```

El `.env.example` ya trae los valores correctos. El `.env` está en `.gitignore` y no se sube a GitHub.

**2. Levantar PostgreSQL**

```bash
docker compose up -d
```

La primera vez descarga la imagen (unos 100 MB). Se crea el contenedor `origenes-postgres` en el puerto **5433**.

**3. Instalar y crear la base de datos**

```bash
cd backend
npm install
npm run db:setup
```

`db:setup` crea el usuario `origenes_app`, la base `origenes_sv`, las 28 tablas, la vista y los datos semilla.

**4. Arrancar la API y probar**

```bash
npm run dev
```

Abre `http://localhost:3000/api/health`. Debe responder `{"ok":true,"baseDatos":"origenes_sv","productos":1}`.

## Uso diario

| Qué quieres hacer | Comando |
|---|---|
| Encender la base (desde la raíz) | `docker compose up -d` |
| Apagarla (desde la raíz) | `docker compose stop` |
| Borrar la base y todos sus datos (desde la raíz) | `docker compose down -v` |
| Crear la base por primera vez (desde `backend`) | `npm run db:setup` |
| Rehacerla desde cero cuando Backend 2 cambie el esquema (desde `backend`) | `npm run db:reset` |
| Arrancar la API (desde `backend`) | `npm run dev` |

Los datos se guardan en un volumen de Docker, así que **no se pierden al apagar o reiniciar la computadora**.

## Conectarse con DBeaver

- Host: `localhost`, puerto: `5433`
- Base: `origenes_sv` (o `postgres` para administrar)
- Usuario `origenes_app` con clave `CambiarEstaClave123!`, o `postgres` con clave `Admin123!`

## Cómo se usa la conexión en el código

Todo el backend comparte un único `Pool` de `pg`, definido en `backend/config/db.js`:

```js
import { query, withTransaction } from '../config/db.js';

// Consulta simple (siempre con parámetros $1, $2 para evitar inyección SQL)
const r = await query('SELECT * FROM insumo WHERE id_insumo = $1', [5]);
console.log(r.rows);

// Varias operaciones juntas, con ROLLBACK automático si algo falla
await withTransaction(async (client) => {
  await client.query('UPDATE inventario_sucursal SET existencia = existencia - $1 WHERE id_sucursal = $2 AND id_insumo = $3', [18, 1, 1]);
  await client.query('INSERT INTO movimiento_inventario (...) VALUES (...)');
});
```

**Reglas del equipo:**
- Nunca concatenar texto en una consulta (`'... WHERE id = ' + id`). Usar siempre `$1, $2`.
- Las tablas y columnas van en **minúsculas y snake_case** (`id_sucursal`, `precio_venta`), tal como están en `database/01_schema.sql`.
- Un `COUNT(*)` llega como texto desde `pg`; conviértelo con `::int` en la consulta.
- Las ventas, compras y planillas deben usar `withTransaction`.

## Si algo falla

| Error | Causa probable |
|---|---|
| `ECONNREFUSED` o timeout | El contenedor está apagado (`docker compose up -d`) o Docker Desktop no está abierto |
| `port is already allocated` | Otro programa usa el 5433. Cambia `DB_PORT` en tu `.env` (por ejemplo a 5434) y repite `docker compose up -d` |
| `Clave incorrecta` en `db:setup` | `DB_ADMIN_PASSWORD` del `.env` no coincide con la del contenedor. Si la cambiaste después de crearlo, borra el volumen con `docker compose down -v` y levanta de nuevo |
| `password authentication failed for user "origenes_app"` | Cambiaste `DB_PASSWORD` después de crear el usuario; corre `npm run db:setup` otra vez para sincronizarla |
| `La base ya tiene las tablas` | Usa `npm run db:reset` |
| `Faltan DB_ADMIN_PASSWORD o DB_PASSWORD` | No existe el `.env` en la raíz del proyecto |
| `relation "xxx" does not exist` | Nombre de tabla mal escrito (recuerda el snake_case en minúsculas) o no se corrió `db:setup` |
