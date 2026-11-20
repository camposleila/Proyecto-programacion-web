import jwt from 'jsonwebtoken';

// Verifica el token del encabezado "Authorization: Bearer <token>" y llena req.usuario.
// IMPORTANTE NO OLVIDAR: req.usuario debe conservar estas mismas 4 llaves, porque el resto del
// equipo las usa en sus controladores (id_usuario, id_empleado, id_sucursal, rol).
export function verificarToken(req, res, next) {
    const encabezado = req.headers.authorization;

    if (!encabezado || !encabezado.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, mensaje: 'Token no proporcionado' });
    }

    const token = encabezado.split(' ')[1];

    try {
    const datos = jwt.verify(token, process.env.JWT_SECRET); // lanza error si es invalido o expiro
    req.usuario = {
        id_usuario: datos.id_usuario,
        id_empleado: datos.id_empleado,
        id_sucursal: datos.id_sucursal,
        rol: datos.rol
    };
    next();
    } catch (err) {
    return res.status(401).json({ ok: false, mensaje: 'Token invalido o vencido' });
    }
}

// Uso: permitirRoles('Administrador', 'Gerente')
// Devuelve el middleware que revisa si el rol del usuario esta en la lista.
export function permitirRoles(...roles) {
    return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
        return res.status(403).json({ ok: false, mensaje: 'No tienes permiso para realizar esta accion' });
    }
    next();
    };
}