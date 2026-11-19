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