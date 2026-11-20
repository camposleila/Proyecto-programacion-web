### Autenticación (Backend 4 + Frontend 4)

#### POST /auth/login
Roles: Público
Descripción: inicia sesión. Devuelve un token JWT (vence en 8 horas) y los datos básicos del usuario.

Body:

```json
{ "nombre_usuario": "admin", "password": "admin123" }
```

Respuesta 200:

```json
{
  "ok": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "usuario": {
      "id_usuario": 1,
      "nombre_usuario": "admin",
      "rol": "Administrador",
      "id_sucursal": 1
    }
  }
}
```

Errores:
- 400: falta `nombre_usuario` o `password`.
- 401: usuario o contraseña incorrectos (mismo mensaje en ambos casos).
- 403: el usuario está inactivo.

El frontend guarda el token y lo envía en cada petición con el encabezado `Authorization: Bearer <token>` (lo hace `services/api.js`).

---

#### GET /auth/me
Roles: Todos (requiere token)
Descripción: devuelve el usuario autenticado. Sirve para saber quién está conectado al recargar la página.

Respuesta 200:

```json
{
  "ok": true,
  "data": {
    "id_usuario": 1,
    "nombre_usuario": "admin",
    "rol": "Administrador",
    "id_empleado": 1,
    "id_sucursal": 1,
    "nombres": "Administrador",
    "apellidos": "Sistema"
  }
}
```

Errores:
- 401: no hay token, es inválido o venció; o el usuario ya no existe o está inactivo.


## -------------------------------------------------------------------------------------- ##


### Sucursales, roles, empleados y usuarios (Backend 4 + Frontend 4)

Todas las rutas requieren el encabezado `Authorization: Bearer <token>`.
Respuestas: `{ "ok": true, "data": ... }` o `{ "ok": false, "mensaje": "..." }`.

---

#### GET /sucursales
Roles: Todos
Descripción: lista las sucursales activas.

Respuesta 200:

```json
{ "ok": true, "data": [ { "id_sucursal": 1, "nombre": "Orígenes Centro", "direccion": "San Salvador", "telefono": null } ] }
```

---

#### GET /roles
Roles: Administrador
Descripción: lista los roles disponibles.

Respuesta 200:

```json
{ "ok": true, "data": [ { "id_rol": 1, "nombre": "Administrador" }, { "id_rol": 2, "nombre": "Gerente" } ] }
```

---

#### GET /empleados
Roles: Administrador, Gerente
Descripción: lista empleados. Filtros opcionales: `?activo=true|false` y `?buscar=texto` (busca en nombres, apellidos y DUI).

Respuesta 200:

```json
{
  "ok": true,
  "data": [
    {
      "id_empleado": 1, "id_sucursal": 1, "sucursal": "Orígenes Centro",
      "nombres": "Ana", "apellidos": "López", "dui": "01234567-8",
      "nit": null, "numero_isss": null, "numero_afp": null,
      "cargo": "Barista", "salario_mensual": 400, "fecha_ingreso": "2026-11-13T00:00:00.000Z", "activo": true
    }
  ]
}
```

---

#### GET /empleados/:id
Roles: Administrador, Gerente
Respuesta 200: un objeto con la misma forma de arriba.
Errores: 400 (id no numérico), 404 (no existe).

---

#### POST /empleados
Roles: Administrador, Gerente

Body (obligatorios: `id_sucursal`, `nombres`, `apellidos`, `dui`, `cargo`, `salario_mensual`):

```json
{
  "id_sucursal": 1, "nombres": "Ana", "apellidos": "López", "dui": "01234567-8",
  "nit": "0614-010190-101-1", "numero_isss": "123456789", "numero_afp": "987654321",
  "cargo": "Barista", "salario_mensual": 400, "fecha_ingreso": "2026-11-13"
}
```

`nit`, `numero_isss`, `numero_afp` y `fecha_ingreso` son opcionales (la fecha por defecto es hoy). `salario_mensual` debe ser un número, no texto. El DUI debe tener el formato `00000000-0`.

Respuesta 201: el empleado creado.
Errores:
- 400: dato obligatorio faltante o con formato inválido; la sucursal no existe.
- 409: ya existe un empleado con ese DUI.

---

#### PUT /empleados/:id
Roles: Administrador, Gerente
Body: los mismos campos que POST, más `activo` (opcional, `true` o `false`). Si `activo` es `false`, el usuario del empleado también queda inactivo.
Respuesta 200: el empleado actualizado.
Errores: 400, 404, 409 (DUI repetido).

---

#### DELETE /empleados/:id
Roles: Administrador, Gerente
Descripción: baja lógica. No borra la fila: marca `activo = false` en el empleado y en su usuario.
Respuesta 200:

```json
{ "ok": true, "data": { "id_empleado": 4, "activo": false } }
```

Errores: 400 (id inválido, o intentas darte de baja a ti mismo), 404.

---

#### GET /usuarios
Roles: Administrador
Respuesta 200 (nunca incluye la contraseña):

```json
{
  "ok": true,
  "data": [
    { "id_usuario": 1, "nombre_usuario": "admin", "activo": true, "id_rol": 1, "rol": "Administrador",
      "id_empleado": 1, "nombres": "Administrador", "apellidos": "Sistema" }
  ]
}
```

---

#### POST /usuarios
Roles: Administrador

Body (todos obligatorios):

```json
{ "id_empleado": 2, "id_rol": 3, "nombre_usuario": "ana", "password": "clave123" }
```

`nombre_usuario`: mínimo 3 caracteres. `password`: mínimo 6 caracteres.
Respuesta 201: el usuario creado, con la misma forma que en la lista.
Errores:
- 400: datos inválidos; el empleado o el rol no existen.
- 409: el nombre de usuario ya existe, o ese empleado ya tiene un usuario.

---

#### PUT /usuarios/:id
Roles: Administrador
Descripción: cambia el rol, el estado y/o la contraseña. Se envía solo lo que cambia, y al menos un campo.

Body de ejemplo:

```json
{ "id_rol": 2, "activo": true, "password": "nuevaClave456" }
```

Respuesta 200: el usuario actualizado.
Errores:
- 400: ningún campo enviado; contraseña corta; el rol no existe; intentas desactivarte o cambiar tu propio rol.
- 404: el usuario no existe.