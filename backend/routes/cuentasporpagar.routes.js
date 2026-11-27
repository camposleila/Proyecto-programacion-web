import { Router } from 'express';
import { pool } from '../config/db.js';
import { requerirPermiso } from '../middleware/permisos.js';

const router = Router();
const MAXIMO_DINERO = 99999999.99;

function enteroPositivo(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function redondear(valor, decimales = 2) {
    const factor = 10 ** decimales;
    return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
}


router.get('/', requerirPermiso('ver_compras'), async (req, res) => {
    const estadoFiltro = req.query.estado ? String(req.query.estado).toUpperCase() : null;
    if (estadoFiltro && !['PENDIENTE', 'PARCIAL', 'PAGADA'].includes(estadoFiltro)) {
        return res.status(400).json({ mensaje: 'Estado de cuenta inválido' });
    }

    try {
        const params = [];
        const condiciones = [];

        if (req.auth.usuario.id_sucursal && !req.auth.permisos?.has('gestionar_sucursales')) {
            params.push(req.auth.usuario.id_sucursal);
            condiciones.push(`c.id_sucursal = $${params.length}`);
        }

        if (estadoFiltro) {
            params.push(estadoFiltro);
            condiciones.push(`cpp.estado = $${params.length}`);
        } else {
            condiciones.push(`cpp.estado IN ('PENDIENTE', 'PARCIAL')`);
        }

        const whereClause = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const resultado = await pool.query(
            `SELECT cpp.*,
                    c.numero_documento,
                    c.fecha_compra,
                    c.id_sucursal,
                    s.nombre AS sucursal_nombre,
                    p.id_proveedor,
                    p.nombre AS proveedor_nombre
             FROM cuenta_por_pagar cpp
             INNER JOIN compra c ON c.id_compra = cpp.id_compra
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             INNER JOIN proveedor p ON p.id_proveedor = c.id_proveedor
             ${whereClause}
             ORDER BY cpp.fecha_vencimiento ASC, cpp.id_cuenta ASC`,
            params
        );

        return res.json({ cuentas: resultado.rows });
    } catch (error) {
        console.error('Error al consultar cuentas por pagar:', error);
        return res.status(500).json({ mensaje: 'No se pudieron consultar las cuentas por pagar' });
    }
});


router.post('/:id/pagos', requerirPermiso('registrar_compras'), async (req, res) => {
    const idCuenta = enteroPositivo(req.params.id);
    const montoEntrada = Number(req.body?.monto);
    const metodoPago = req.body?.metodo_pago;
    const monto = redondear(montoEntrada);

    if (
        !idCuenta ||
        !Number.isFinite(montoEntrada) || montoEntrada <= 0 || monto <= 0 || monto > MAXIMO_DINERO ||
        typeof metodoPago !== 'string' || !metodoPago.trim() || metodoPago.length > 15
    ) {
        return res.status(400).json({ mensaje: 'Revisa el monto y el método de pago' });
    }

    const client = await pool.connect();
    let transaccionIniciada = false;

    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        transaccionIniciada = true;

        const cuentaRes = await client.query(
            `SELECT cpp.*, c.id_sucursal
             FROM cuenta_por_pagar cpp
             INNER JOIN compra c ON c.id_compra = cpp.id_compra
             WHERE cpp.id_cuenta = $1
             FOR UPDATE OF cpp`,
            [idCuenta]
        );

        const cuenta = cuentaRes.rows[0];
        if (!cuenta) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Cuenta por pagar no encontrada' });
        }

        if (
            req.auth.usuario.id_sucursal &&
            req.auth.usuario.id_sucursal !== cuenta.id_sucursal &&
            !req.auth.permisos?.has('gestionar_sucursales')
        ) {
            await client.query('ROLLBACK');
            return res.status(403).json({ mensaje: 'No tienes permiso sobre esta sucursal' });
        }

        if (cuenta.estado === 'PAGADA' || Number(cuenta.saldo) <= 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ mensaje: 'Esta cuenta ya se encuentra pagada' });
        }

        const saldoActual = redondear(Number(cuenta.saldo));
        if (monto > saldoActual) {
            await client.query('ROLLBACK');
            return res.status(409).json({ mensaje: 'El monto supera el saldo pendiente' });
        }

        const pagoInsert = await client.query(
            `INSERT INTO pago_proveedor (id_cuenta, monto, metodo_pago)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [idCuenta, monto, metodoPago.trim().toUpperCase()]
        );

        const nuevoSaldo = redondear(saldoActual - monto);
        const nuevoEstado = nuevoSaldo === 0 ? 'PAGADA' : 'PARCIAL';

        const cuentaActualizada = await client.query(
            `UPDATE cuenta_por_pagar
             SET saldo = $1, estado = $2
             WHERE id_cuenta = $3
             RETURNING *`,
            [nuevoSaldo, nuevoEstado, idCuenta]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            mensaje: 'Pago a proveedor registrado',
            pago: pagoInsert.rows[0],
            cuenta_por_pagar: cuentaActualizada.rows[0]
        });
    } catch (error) {
        if (transaccionIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (rbError) {
                console.error('Error al revertir pago a proveedor:', rbError);
            }
        }
        console.error('Error al registrar pago a proveedor:', error);
        return res.status(500).json({ mensaje: 'No se pudo registrar el pago' });
    } finally {
        client.release();
    }
});

export default router;