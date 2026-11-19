import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';

// POST /api/auth/login
export async function login(req, res, next) {
    try {
    const { nombre_usuario, password } = req.body;

    // Validar el body
    if (typeof nombre_usuario !== 'string' || typeof password !== 'string' || !nombre_usuario || !password) {
        return res.status(400).json({ ok: false, mensaje: 'Debes enviar nombre_usuario y password' });
    }

    // Buscar al usuario con su rol y su sucursal
    const resultado = await query(
        `SELECT u.id_usuario, u.id_empleado, u.nombre_usuario, u.password_hash, u.activo,
                r.nombre AS rol, e.id_sucursal
        FROM usuario u
        JOIN rol r      ON r.id_rol = u.id_rol
        JOIN empleado e ON e.id_empleado = u.id_empleado
        WHERE u.nombre_usuario = $1`,
        [nombre_usuario]
    );
    const usuario = resultado.rows[0];

    // Comparar la contrasenia. Mismo mensaje si el usuario no existe o la clave falla,
    // para no revelar que usuarios existen
    const claveCorrecta = usuario ? await bcrypt.compare(password, usuario.password_hash) : false;
    if (!claveCorrecta) {
        return res.status(401).json({ ok: false, mensaje: 'Usuario o contraseña incorrectos' });
    }

    // Usuario desactivado (se revisa después de validar la clave)
    if (!usuario.activo) {
        return res.status(403).json({ ok: false, mensaje: 'El usuario está inactivo' });
    }

    // Firmar el token (nunca se incluye la contrasenia ni su hash)
    const payload = {
        id_usuario: usuario.id_usuario,
        id_empleado: usuario.id_empleado,
        rol: usuario.rol,
        id_sucursal: usuario.id_sucursal
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    // Responder
    res.json({
        ok: true,
        data: {
        token,
        usuario: {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        rol: usuario.rol,
        id_sucursal: usuario.id_sucursal
        }
        }
    });
    } catch (err) {
    next(err);
    }
}

// GET /api/auth/me  (requiere token)
export async function me(req, res, next) {
    try {
    const resultado = await query(
        `SELECT u.id_usuario, u.nombre_usuario, r.nombre AS rol,
        e.id_empleado, e.id_sucursal, e.nombres, e.apellidos
        FROM usuario u
        JOIN rol r      ON r.id_rol = u.id_rol
        JOIN empleado e ON e.id_empleado = u.id_empleado
        WHERE u.id_usuario = $1 AND u.activo`,
        [req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        return res.status(401).json({ ok: false, mensaje: 'La sesión ya no es válida' });
    }
    res.json({ ok: true, data: resultado.rows[0] });
    } catch (err) {
    next(err);
    }
}