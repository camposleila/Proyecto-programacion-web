import { Router } from 'express';
import { pool } from '../config/db.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();
router.use(verificarToken);

function enteroPositivo(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function limpiarTextoOpcional(valor, maxLongitud) {
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== 'string') return undefined;
    const limpio = valor.trim();
    if (!limpio) return null;
    return limpio.length <= maxLongitud ? limpio : undefined;
}

function validarDatosProveedor(body, incluirActivo = false) {
    const { nombre, nit, nrc, telefono, correo, activo } = body ?? {};

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
        return { error: 'El nombre del proveedor es obligatorio y no debe superar 150 caracteres' };
    }

    const nitLimpio = limpiarTextoOpcional(nit, 17);
    if (nitLimpio === undefined) {
        return { error: 'El NIT no debe superar 17 caracteres' };
    }

    const nrcLimpio = limpiarTextoOpcional(nrc, 15);
    if (nrcLimpio === undefined) {
        return { error: 'El NRC no debe superar 15 caracteres' };
    }

    const telefonoLimpio = limpiarTextoOpcional(telefono, 20);
    if (telefonoLimpio === undefined) {
        return { error: 'El teléfono no debe superar 20 caracteres' };
    }

    const correoLimpio = limpiarTextoOpcional(correo, 120);
    if (correoLimpio === undefined) {
        return { error: 'El correo no debe superar 120 caracteres' };
    }
    if (correoLimpio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
        return { error: 'El formato del correo electrónico no es válido' };
    }

    if (incluirActivo && activo !== undefined && typeof activo !== 'boolean') {
        return { error: 'El campo activo debe ser booleano (true o false)' };
    }

    return {
        datos: {
            nombre: nombre.trim(),
            nit: nitLimpio,
            nrc: nrcLimpio,
            telefono: telefonoLimpio,
            correo: correoLimpio ? correoLimpio.toLowerCase() : null,
            activo: incluirActivo ? (activo ?? null) : true
        }
    };
}

router.get('/', permitirRoles('Administrador', 'Gerente'), async (req, res) => {
    const incluirInactivos = req.query.todos === 'true';
    const busqueda = typeof req.query.buscar === 'string' ? req.query.buscar.trim() : '';

    try {
        const params = [];
        const condiciones = [];

        if (!incluirInactivos) {
            condiciones.push('activo = TRUE');
        }

        if (busqueda) {
            params.push(`%${busqueda}%`);
            condiciones.push(
                `(nombre ILIKE $${params.length}
                  OR nit ILIKE $${params.length}
                  OR nrc ILIKE $${params.length}
                  OR telefono ILIKE $${params.length}
                  OR correo ILIKE $${params.length})`
            );
        }

        const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const resultado = await pool.query(
            `SELECT id_proveedor, nombre, nit, nrc, telefono, correo, activo
             FROM proveedor
             ${whereClause}
             ORDER BY nombre ASC`,
            params
        );

        return res.json({ proveedores: resultado.rows });
    } catch (error) {
        console.error('Error al consultar proveedores:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar los proveedores' });
    }
});

router.get('/:id', permitirRoles('Administrador', 'Gerente'), async (req, res) => {
    const idProveedor = enteroPositivo(req.params.id);
    if (!idProveedor) {
        return res.status(400).json({ ok: false, mensaje: 'El id de proveedor no es válido' });
    }

    try {
        const resultado = await pool.query(
            `SELECT id_proveedor, nombre, nit, nrc, telefono, correo, activo
             FROM proveedor
             WHERE id_proveedor = $1`,
            [idProveedor]
        );

        const proveedor = resultado.rows[0];
        if (!proveedor) {
            return res.status(404).json({ ok: false, mensaje: 'Proveedor no encontrado' });
        }

        return res.json({ proveedor });
    } catch (error) {
        console.error('Error al consultar proveedor:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo consultar el proveedor' });
    }
});

router.post('/', permitirRoles('Administrador', 'Gerente'), async (req, res) => {
    const { error, datos } = validarDatosProveedor(req.body, false);
    if (error) {
        return res.status(400).json({ ok: false, mensaje: error });
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO proveedor (nombre, nit, nrc, telefono, correo, activo)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             RETURNING id_proveedor, nombre, nit, nrc, telefono, correo, activo`,
            [datos.nombre, datos.nit, datos.nrc, datos.telefono, datos.correo]
        );

        return res.status(201).json({
            ok: true,
            mensaje: 'Proveedor registrado exitosamente',
            proveedor: resultado.rows[0]
        });
    } catch (err) {
        console.error('Error al registrar proveedor:', err);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo registrar el proveedor' });
    }
});

router.put('/:id', permitirRoles('Administrador', 'Gerente'), async (req, res) => {
    const idProveedor = enteroPositivo(req.params.id);
    if (!idProveedor) {
        return res.status(400).json({ ok: false, mensaje: 'El id de proveedor no es válido' });
    }

    const { error, datos } = validarDatosProveedor(req.body, true);
    if (error) {
        return res.status(400).json({ ok: false, mensaje: error });
    }

    try {
        const resultado = await pool.query(
            `UPDATE proveedor
             SET nombre = $1,
                 nit = $2,
                 nrc = $3,
                 telefono = $4,
                 correo = $5,
                 activo = COALESCE($6, activo)
             WHERE id_proveedor = $7
             RETURNING id_proveedor, nombre, nit, nrc, telefono, correo, activo`,
            [
                datos.nombre,
                datos.nit,
                datos.nrc,
                datos.telefono,
                datos.correo,
                datos.activo,
                idProveedor
            ]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({ ok: false, mensaje: 'Proveedor no encontrado' });
        }

        return res.json({
            ok: true,
            mensaje: 'Proveedor actualizado exitosamente',
            proveedor: resultado.rows[0]
        });
    } catch (err) {
        console.error('Error al actualizar proveedor:', err);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo actualizar el proveedor' });
    }
});

router.delete('/:id', permitirRoles('Administrador', 'Gerente'), async (req, res) => {
    const idProveedor = enteroPositivo(req.params.id);
    if (!idProveedor) {
        return res.status(400).json({ ok: false, mensaje: 'El id de proveedor no es válido' });
    }

    try {
        const resultado = await pool.query(
            `UPDATE proveedor
             SET activo = FALSE
             WHERE id_proveedor = $1 AND activo = TRUE
             RETURNING id_proveedor, nombre, activo`,
            [idProveedor]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                mensaje: 'El proveedor no existe o ya se encuentra inactivo'
            });
        }

        return res.json({
            ok: true,
            mensaje: 'Proveedor desactivado exitosamente',
            proveedor: resultado.rows[0]
        });
    } catch (err) {
        console.error('Error al desactivar proveedor:', err);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo desactivar el proveedor' });
    }
});

export default router;