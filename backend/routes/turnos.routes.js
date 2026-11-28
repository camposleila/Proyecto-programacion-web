import { Router } from 'express';
import { pool } from '../config/db.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();
router.use(verificarToken);

const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'BITCOIN', 'CHIVO'];

function montoValido(valor, permitirCero = false) {
    if (valor === null || valor === '' || valor === undefined) return false;

    const monto = Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
    return Number.isFinite(monto) &&
        monto >= (permitirCero ? 0 : 0.01) &&
        monto <= 99999999.99;
}

function redondearMoneda(valor) {
    return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function validarId(valor) {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function calcularMontosEsperados(client, turno) {
    const pagosResultado = await client.query(
        `SELECT vp.metodo_pago, COALESCE(SUM(vp.monto), 0) AS total
         FROM venta v
         INNER JOIN venta_pago vp ON vp.id_venta = v.id_venta
         WHERE v.id_turno = $1
           AND v.estado = 'EMITIDA'
         GROUP BY vp.metodo_pago`,
        [turno.id_turno]
    );

    const esperados = {
        EFECTIVO: 0,
        TARJETA: 0,
        BITCOIN: 0,
        CHIVO: 0
    };

    for (const row of pagosResultado.rows) {
        if (esperados[row.metodo_pago] !== undefined) {
            esperados[row.metodo_pago] = redondearMoneda(row.total);
        }
    }

    esperados.EFECTIVO = redondearMoneda(
        esperados.EFECTIVO + Number(turno.monto_apertura)
    );

    return esperados;
}

router.get('/actual', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT tc.*, c.nombre AS nombre_caja, c.id_sucursal
             FROM turno_caja tc
             INNER JOIN caja c ON c.id_caja = tc.id_caja
             WHERE tc.id_usuario = $1 AND tc.estado = 'ABIERTO'
             ORDER BY tc.fecha_apertura DESC
             LIMIT 1`,
            [req.usuario.id_usuario]
        );

        const turno = resultado.rows[0] ?? null;
        return res.json({ turno });
    } catch (error) {
        console.error('Error al consultar turno abierto:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo consultar el turno actual' });
    }
});

router.post('/abrir', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    const idCaja = validarId(req.body?.id_caja);
    const { monto_apertura } = req.body ?? {};

    if (!idCaja || !montoValido(monto_apertura, true)) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Debe especificar una caja válida y un monto de apertura mayor o igual a 0'
        });
    }

    try {
        const cajaRes = await pool.query(
            `SELECT c.id_caja, c.id_sucursal, s.activa
             FROM caja c
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             WHERE c.id_caja = $1`,
            [idCaja]
        );

        if (cajaRes.rowCount === 0 || !cajaRes.rows[0].activa) {
            return res.status(404).json({ ok: false, mensaje: 'Caja no encontrada o sucursal inactiva' });
        }

        const sucursalUsuario = req.usuario.id_sucursal;
        if (
            sucursalUsuario &&
            sucursalUsuario !== cajaRes.rows[0].id_sucursal &&
            req.usuario.rol !== 'Administrador'
        ) {
            return res.status(403).json({
                ok: false,
                mensaje: 'No tienes permiso para abrir cajas en otra sucursal'
            });
        }

        const turnoExistente = await pool.query(
            `SELECT id_turno FROM turno_caja WHERE id_caja = $1 AND estado = 'ABIERTO'`,
            [idCaja]
        );

        if (turnoExistente.rowCount > 0) {
            return res.status(409).json({
                ok: false,
                mensaje: 'Ya existe un turno abierto para esta caja'
            });
        }

        const resultado = await pool.query(
            `INSERT INTO turno_caja (id_caja, id_usuario, monto_apertura, estado)
             VALUES ($1, $2, $3, 'ABIERTO')
             RETURNING *`,
            [
                idCaja,
                req.usuario.id_usuario,
                redondearMoneda(monto_apertura)
            ]
        );

        return res.status(201).json({
            ok: true,
            mensaje: 'Turno de caja abierto exitosamente',
            turno: resultado.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                ok: false,
                mensaje: 'Ya existe un turno abierto para esta caja'
            });
        }

        console.error('Error al abrir turno:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo abrir el turno de caja' });
    }
});

router.get('/:id/cuadre', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    const idTurno = validarId(req.params.id);
    if (!idTurno) {
        return res.status(400).json({ ok: false, mensaje: 'ID de turno inválido' });
    }

    try {
        const turnoRes = await pool.query(
            `SELECT tc.*, c.nombre AS nombre_caja, s.nombre AS nombre_sucursal
             FROM turno_caja tc
             INNER JOIN caja c ON c.id_caja = tc.id_caja
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             WHERE tc.id_turno = $1`,
            [idTurno]
        );

        const turno = turnoRes.rows[0];
        if (!turno) {
            return res.status(404).json({ ok: false, mensaje: 'Turno no encontrado' });
        }

        if (turno.estado === 'CERRADO') {
            const detalleRes = await pool.query(
                `SELECT metodo_pago, monto_esperado, monto_contado, diferencia
                 FROM cierre_caja_detalle
                 WHERE id_turno = $1
                 ORDER BY metodo_pago`,
                [idTurno]
            );

            return res.json({
                turno,
                detalle: detalleRes.rows
            });
        }

        const esperados = await calcularMontosEsperados(pool, turno);
        const detalleProyectado = METODOS_PAGO.map((metodo) => ({
            metodo_pago: metodo,
            monto_esperado: esperados[metodo],
            monto_contado: null,
            diferencia: null
        }));

        return res.json({
            turno,
            detalle: detalleProyectado
        });
    } catch (error) {
        console.error('Error al obtener cuadre de turno:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo obtener el cuadre del turno' });
    }
});

router.post('/:id/cerrar', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    const idTurno = validarId(req.params.id);
    const { conteos } = req.body ?? {};

    if (!idTurno || !Array.isArray(conteos)) {
        return res.status(400).json({
            ok: false,
            mensaje: 'Debe enviar un ID de turno válido y el arreglo de conteos por método de pago'
        });
    }

    const mapaContados = new Map();
    for (const item of conteos) {
        const metodo = String(item?.metodo_pago || '').toUpperCase();
        if (!METODOS_PAGO.includes(metodo) || !montoValido(item?.monto_contado, true)) {
            return res.status(400).json({
                ok: false,
                mensaje: `Datos inválidos para el método de pago: ${item?.metodo_pago}`
            });
        }
        mapaContados.set(metodo, redondearMoneda(item.monto_contado));
    }

    const client = await pool.connect();
    let transaccionIniciada = false;

    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        transaccionIniciada = true;

        const turnoRes = await client.query(
            `SELECT *
             FROM turno_caja
             WHERE id_turno = $1 AND id_usuario = $2 AND estado = 'ABIERTO'
             FOR UPDATE`,
            [idTurno, req.usuario.id_usuario]
        );

        const turno = turnoRes.rows[0];
        if (!turno) {
            await client.query('ROLLBACK');
            transaccionIniciada = false;
            return res.status(409).json({
                ok: false,
                mensaje: 'El turno ya fue cerrado, no existe o pertenece a otro usuario'
            });
        }

        const esperados = await calcularMontosEsperados(client, turno);

        const detallesGuardados = [];
        for (const metodo of METODOS_PAGO) {
            const montoEsperado = esperados[metodo];
            const montoContado = mapaContados.get(metodo) ?? 0;

            const insertDetalle = await client.query(
                `INSERT INTO cierre_caja_detalle (
                    id_turno, metodo_pago, monto_esperado, monto_contado
                 )
                 VALUES ($1, $2, $3, $4)
                 RETURNING metodo_pago, monto_esperado, monto_contado, diferencia`,
                [idTurno, metodo, montoEsperado, montoContado]
            );

            detallesGuardados.push(insertDetalle.rows[0]);
        }

        const turnoCerradoRes = await client.query(
            `UPDATE turno_caja
             SET fecha_cierre = NOW(),
                 estado = 'CERRADO'
             WHERE id_turno = $1
             RETURNING *`,
            [idTurno]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.json({
            ok: true,
            mensaje: 'Turno cerrado exitosamente',
            turno: turnoCerradoRes.rows[0],
            detalle: detallesGuardados
        });
    } catch (error) {
        if (transaccionIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error al revertir el cierre de turno:', rollbackError);
            }
        }

        console.error('Error al cerrar turno:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo cerrar el turno de caja' });
    } finally {
        client.release();
    }
});

// Listar cajas activas de la sucursal (para el <select> de abrir turno)
router.get('/cajas', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    try {
        const params = [];
        let where = 'WHERE s.activa = TRUE';

        if (req.usuario.id_sucursal && req.usuario.rol !== 'Administrador') {
            params.push(req.usuario.id_sucursal);
            where += ` AND c.id_sucursal = $${params.length}`;
        }

        const resultado = await pool.query(
            `SELECT c.id_caja, c.nombre, c.id_sucursal, s.nombre AS nombre_sucursal
             FROM caja c
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             ${where}
             ORDER BY c.id_caja ASC`,
            params
        );

        return res.json({ cajas: resultado.rows });
    } catch (error) {
        console.error('Error al listar cajas:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudieron consultar las cajas' });
    }
});

// Historial de turnos cerrados (para la pestaña Historial de cierres)
router.get('/', permitirRoles('Administrador', 'Gerente', 'Cajero'), async (req, res) => {
    const sucursalQuery = validarId(req.query.id_sucursal);

    try {
        const params = [];
        const condiciones = [`tc.estado = 'CERRADO'`];

        if (req.usuario.rol !== 'Administrador') {
            if (req.usuario.id_sucursal) {
                params.push(req.usuario.id_sucursal);
                condiciones.push(`c.id_sucursal = $${params.length}`);
            }
        } else if (sucursalQuery) {
            params.push(sucursalQuery);
            condiciones.push(`c.id_sucursal = $${params.length}`);
        }

        const resultado = await pool.query(
            `SELECT tc.id_turno,
                    tc.id_caja,
                    tc.id_usuario,
                    tc.fecha_apertura,
                    tc.monto_apertura,
                    tc.fecha_cierre,
                    tc.estado,
                    c.nombre AS nombre_caja,
                    c.id_sucursal,
                    s.nombre AS nombre_sucursal,
                    u.nombre_usuario,
                    COALESCE(SUM(ccd.monto_esperado), 0)::numeric(12,2) AS total_esperado,
                    COALESCE(SUM(ccd.monto_contado), 0)::numeric(12,2) AS total_contado,
                    COALESCE(SUM(ccd.diferencia), 0)::numeric(12,2) AS diferencia_total
             FROM turno_caja tc
             INNER JOIN caja c ON c.id_caja = tc.id_caja
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             INNER JOIN usuario u ON u.id_usuario = tc.id_usuario
             LEFT JOIN cierre_caja_detalle ccd ON ccd.id_turno = tc.id_turno
             WHERE ${condiciones.join(' AND ')}
             GROUP BY tc.id_turno, c.nombre, c.id_sucursal, s.nombre, u.nombre_usuario
             ORDER BY tc.fecha_cierre DESC
             LIMIT 50`,
            params
        );

        return res.json({ turnos: resultado.rows });
    } catch (error) {
        console.error('Error al consultar historial de turnos:', error);
        return res.status(500).json({ ok: false, mensaje: 'No se pudo consultar el historial' });
    }
});

export default router;