import { query, withTransaction } from '../config/db.js';

const REGEX_DUI = /^\d{8}-\d$/;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';
const textoOpcional = (valor) => (textoValido(valor) ? valor.trim() : null);

// Valida el body de POST y PUT. Devuelve un mensaje de error, o null si todo está bien.
function validarEmpleado(body) {
    const { id_sucursal, nombres, apellidos, dui, cargo, salario_mensual, fecha_ingreso } = body;

    if (!esIdValido(id_sucursal)) return 'id_sucursal es obligatorio y debe ser un número válido';
    if (!textoValido(nombres) || !textoValido(apellidos)) return 'nombres y apellidos son obligatorios';
    if (!textoValido(dui) || !REGEX_DUI.test(dui.trim())) {
    return 'El DUI es obligatorio y debe tener el formato 00000000-0';
    }
    if (!textoValido(cargo)) return 'cargo es obligatorio';
    if (typeof salario_mensual !== 'number' || !Number.isFinite(salario_mensual) || salario_mensual < 0) {
    return 'salario_mensual debe ser un número mayor o igual a 0';
    }
    if (fecha_ingreso !== undefined && fecha_ingreso !== null && !REGEX_FECHA.test(fecha_ingreso)) {
    return 'fecha_ingreso debe tener el formato AAAA-MM-DD';
    }
    return null;
}

// Traduce los errores de PostgreSQL más comunes a respuestas HTTP claras
function responderErrorBD(err, res, next) {
    if (err.code === '23505') {
    return res.status(409).json({ ok: false, mensaje: 'Ya existe un empleado con ese DUI' });
    }
    if (err.code === '23503') {
    return res.status(400).json({ ok: false, mensaje: 'La sucursal indicada no existe' });
    }
    if (err.code === '22007' || err.code === '22008') {
    return res.status(400).json({ ok: false, mensaje: 'La fecha de ingreso no es válida' });
    }
    return next(err);
}

// GET /api/empleados?activo=true|false&buscar=texto
export async function listarEmpleados(req, res, next) {
    try {
    const { activo, buscar } = req.query;
    const condiciones = [];
    const valores = [];

    if (activo === 'true' || activo === 'false') {
        valores.push(activo === 'true');
        condiciones.push(`e.activo = $${valores.length}`);
    }
    if (typeof buscar === 'string' && buscar.trim() !== '') {
        valores.push(`%${buscar.trim()}%`);
        const n = valores.length;
        condiciones.push(`(e.nombres ILIKE $${n} OR e.apellidos ILIKE $${n} OR e.dui ILIKE $${n})`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const resultado = await query(
        `SELECT e.*, s.nombre AS sucursal
        FROM empleado e
        JOIN sucursal s ON s.id_sucursal = e.id_sucursal
        ${where}
        ORDER BY e.apellidos, e.nombres`,
        valores
    );
    res.json({ ok: true, data: resultado.rows });
    } catch (err) {
    next(err);
    }
}

// GET /api/empleados/:id
export async function obtenerEmpleado(req, res, next) {
    try {
    const { id } = req.params;
    if (!esIdValido(id)) {
        return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const resultado = await query(
        `SELECT e.*, s.nombre AS sucursal
        FROM empleado e
        JOIN sucursal s ON s.id_sucursal = e.id_sucursal
        WHERE e.id_empleado = $1`,
        [id]
    );
    if (resultado.rows.length === 0) {
        return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });
    }
    res.json({ ok: true, data: resultado.rows[0] });
    } catch (err) {
    next(err);
    }
}

// POST /api/empleados
export async function crearEmpleado(req, res, next) {
    try {
    const error = validarEmpleado(req.body);
    if (error) return res.status(400).json({ ok: false, mensaje: error });

    const { id_sucursal, nombres, apellidos, dui, nit, numero_isss, numero_afp,
            cargo, salario_mensual, fecha_ingreso } = req.body;

    const resultado = await query(
        `INSERT INTO empleado
            (id_sucursal, nombres, apellidos, dui, nit, numero_isss, numero_afp, cargo, salario_mensual, fecha_ingreso)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::date, CURRENT_DATE))
        RETURNING *`,
        [id_sucursal, nombres.trim(), apellidos.trim(), dui.trim(), textoOpcional(nit),
        textoOpcional(numero_isss), textoOpcional(numero_afp), cargo.trim(), salario_mensual,
        fecha_ingreso ?? null]
    );
    res.status(201).json({ ok: true, data: resultado.rows[0] });
    } catch (err) {
    responderErrorBD(err, res, next);
    }
}

// PUT /api/empleados/:id
export async function actualizarEmpleado(req, res, next) {
    try {
    const { id } = req.params;
    if (!esIdValido(id)) {
        return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }
    const error = validarEmpleado(req.body);
    if (error) return res.status(400).json({ ok: false, mensaje: error });

    const { id_sucursal, nombres, apellidos, dui, nit, numero_isss, numero_afp,
            cargo, salario_mensual, fecha_ingreso, activo } = req.body;

    // Si el empleado queda inactivo, su usuario también: ambas cosas o ninguna
    const empleado = await withTransaction(async (client) => {
        const resultado = await client.query(
            `UPDATE empleado
            SET id_sucursal = $1, nombres = $2, apellidos = $3, dui = $4, nit = $5,
                numero_isss = $6, numero_afp = $7, cargo = $8, salario_mensual = $9,
                fecha_ingreso = COALESCE($10::date, fecha_ingreso),
                activo = COALESCE($11::boolean, activo)
            WHERE id_empleado = $12
            RETURNING *`,
        [id_sucursal, nombres.trim(), apellidos.trim(), dui.trim(), textoOpcional(nit),
            textoOpcional(numero_isss), textoOpcional(numero_afp), cargo.trim(), salario_mensual,
            fecha_ingreso ?? null, typeof activo === 'boolean' ? activo : null, id]
        );
        const fila = resultado.rows[0];
        if (fila && fila.activo === false) {
        await client.query('UPDATE usuario SET activo = false WHERE id_empleado = $1', [id]);
        }
        return fila;
    });

    if (!empleado) {
        return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });
    }
    res.json({ ok: true, data: empleado });
    } catch (err) {
    responderErrorBD(err, res, next);
    }
}

// DELETE /api/empleados/:id  (baja lógica: no borra la fila)
export async function darDeBajaEmpleado(req, res, next) {
    try {
    const { id } = req.params;
    if (!esIdValido(id)) {
        return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }
    if (Number(id) === req.usuario.id_empleado) {
        return res.status(400).json({ ok: false, mensaje: 'No puedes darte de baja a ti mismo' });
    }

    const encontrado = await withTransaction(async (client) => {
        const resultado = await client.query(
        'UPDATE empleado SET activo = false WHERE id_empleado = $1 RETURNING id_empleado',
        [id]
        );
        if (resultado.rows.length === 0) return false;
        await client.query('UPDATE usuario SET activo = false WHERE id_empleado = $1', [id]);
        return true;
    });

    if (!encontrado) {
        return res.status(404).json({ ok: false, mensaje: 'Empleado no encontrado' });
    }
    res.json({ ok: true, data: { id_empleado: Number(id), activo: false } });
    } catch (err) {
    next(err);
    }
}