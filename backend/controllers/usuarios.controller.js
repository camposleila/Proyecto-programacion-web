import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';

// Columnas que se devuelven. NUNCA incluir password_hash.
const COLUMNAS = `u.id_usuario, u.nombre_usuario, u.activo, u.id_rol, r.nombre AS rol,
                    u.id_empleado, e.nombres, e.apellidos`;
const DESDE = `FROM usuario u
                JOIN rol r      ON r.id_rol = u.id_rol
                JOIN empleado e ON e.id_empleado = u.id_empleado`;

// GET /api/usuarios
export async function listarUsuarios(req, res, next) {
    try {
    const resultado = await query(`SELECT ${COLUMNAS} ${DESDE} ORDER BY u.nombre_usuario`);
    res.json({ ok: true, data: resultado.rows });
    } catch (err) {
    next(err);
    }
}

// POST /api/usuarios
export async function crearUsuario(req, res, next) {
    try {
    const { id_empleado, id_rol, nombre_usuario, password } = req.body;

    if (!esIdValido(id_empleado) || !esIdValido(id_rol)) {
        return res.status(400).json({ ok: false, mensaje: 'id_empleado e id_rol son obligatorios' });
    }
    if (!textoValido(nombre_usuario) || nombre_usuario.trim().length < 3) {
        return res.status(400).json({ ok: false, mensaje: 'nombre_usuario es obligatorio (mínimo 3 caracteres)' });
    }
    if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const insertado = await query(
        `INSERT INTO usuario (id_empleado, id_rol, nombre_usuario, password_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id_usuario`,
        [id_empleado, id_rol, nombre_usuario.trim(), passwordHash]
    );

    const creado = await query(`SELECT ${COLUMNAS} ${DESDE} WHERE u.id_usuario = $1`, [insertado.rows[0].id_usuario]);
    res.status(201).json({ ok: true, data: creado.rows[0] });
    } catch (err) {
    if (err.code === '23505') {
        const mensaje = String(err.constraint).includes('nombre_usuario')
        ? 'El nombre de usuario ya existe'
        : 'Ese empleado ya tiene un usuario';
        return res.status(409).json({ ok: false, mensaje });
    }
    if (err.code === '23503') {
        const mensaje = String(err.constraint).includes('id_rol')
        ? 'El rol indicado no existe'
        : 'El empleado indicado no existe';
        return res.status(400).json({ ok: false, mensaje });
    }
    next(err);
    }
}

// PUT /api/usuarios/:id   (se puede enviar id_rol, activo y/o password)
export async function actualizarUsuario(req, res, next) {
    try {
    const { id } = req.params;
    if (!esIdValido(id)) {
        return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const { id_rol, activo, password } = req.body;

    // Un administrador no puede quitarse a sí mismo el acceso o el rol
    if (Number(id) === req.usuario.id_usuario && (activo === false || id_rol !== undefined)) {
        return res.status(400).json({ ok: false, mensaje: 'No puedes desactivarte ni cambiar tu propio rol' });
    }

    // Se arma el UPDATE solo con los campos que llegaron
    const campos = [];
    const valores = [];

    if (id_rol !== undefined) {
        if (!esIdValido(id_rol)) {
        return res.status(400).json({ ok: false, mensaje: 'id_rol debe ser un número válido' });
        }
        valores.push(id_rol);
        campos.push(`id_rol = $${valores.length}`);
    }
    if (activo !== undefined) {
        if (typeof activo !== 'boolean') {
        return res.status(400).json({ ok: false, mensaje: 'activo debe ser true o false' });
        }
        valores.push(activo);
        campos.push(`activo = $${valores.length}`);
    }
    if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 6 caracteres' });
        }
        valores.push(await bcrypt.hash(password, 10));
        campos.push(`password_hash = $${valores.length}`);
    }
    if (campos.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'Debes enviar al menos un campo: id_rol, activo o password' });
    }

    valores.push(id);
    const actualizado = await query(
        `UPDATE usuario SET ${campos.join(', ')} WHERE id_usuario = $${valores.length} RETURNING id_usuario`,
        valores
    );
    if (actualizado.rows.length === 0) {
        return res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
    }

    const usuario = await query(`SELECT ${COLUMNAS} ${DESDE} WHERE u.id_usuario = $1`, [id]);
    res.json({ ok: true, data: usuario.rows[0] });
    } catch (err) {
    if (err.code === '23503') {
        return res.status(400).json({ ok: false, mensaje: 'El rol indicado no existe' });
    }
    next(err);
    }
}