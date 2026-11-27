import { Router } from 'express';
import { pool } from '../config/db.js';
import { requerirPermiso } from '../middleware/permisos.js';

const router = Router();
const MAXIMO_DINERO = 99999999.99;
const CONDICIONES_PAGO = new Set(['CONTADO', 'CREDITO']);

function enteroPositivo(valor) {
    const numero = Number(valor);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function redondear(valor, decimales = 2) {
    const factor = 10 ** decimales;
    return Math.round((Number(valor) + Number.EPSILON) * factor) / factor;
}

function esFechaValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function leerSucursal(req, valor) {
    if (req.auth.usuario.id_sucursal) return req.auth.usuario.id_sucursal;
    if (req.auth.permisos?.has('gestionar_sucursales')) return enteroPositivo(valor);
    return null;
}


router.get('/', requerirPermiso('ver_compras'), async (req, res) => {
    const pagina = Number(req.query.pagina ?? 1);
    const limite = Number(req.query.limite ?? 25);
    const sucursalQuery = req.query.id_sucursal ? enteroPositivo(req.query.id_sucursal) : null;

    if (
        !Number.isInteger(pagina) || pagina < 1 ||
        !Number.isInteger(limite) || limite < 1 || limite > 100 ||
        (req.query.id_sucursal && !sucursalQuery)
    ) {
        return res.status(400).json({ mensaje: 'Revisa la paginación y la sucursal' });
    }

    const idSucursalFiltro = req.auth.usuario.id_sucursal
        ? req.auth.usuario.id_sucursal
        : (req.auth.permisos?.has('gestionar_sucursales') ? sucursalQuery : null);

    try {
        const params = [];
        let whereClause = '';

        if (idSucursalFiltro) {
            params.push(idSucursalFiltro);
            whereClause = `WHERE c.id_sucursal = $${params.length}`;
        }

        const totalRes = await pool.query(
            `SELECT COUNT(*)::int AS total FROM compra c ${whereClause}`,
            params
        );

        const offset = (pagina - 1) * limite;
        const listParams = [...params, limite, offset];

        const comprasRes = await pool.query(
            `SELECT c.*,
                    p.nombre AS proveedor_nombre,
                    s.nombre AS sucursal_nombre,
                    cpp.id_cuenta,
                    cpp.saldo AS saldo_pendiente,
                    cpp.estado AS estado_cuenta
             FROM compra c
             INNER JOIN proveedor p ON p.id_proveedor = c.id_proveedor
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             LEFT JOIN cuenta_por_pagar cpp ON cpp.id_compra = c.id_compra
             ${whereClause}
             ORDER BY c.fecha_compra DESC, c.id_compra DESC
             LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            listParams
        );

        return res.json({
            pagina,
            limite,
            total: totalRes.rows[0].total,
            compras: comprasRes.rows
        });
    } catch (error) {
        console.error('Error al consultar compras:', error);
        return res.status(500).json({ mensaje: 'No se pudieron consultar las compras' });
    }
});


router.get('/:id', requerirPermiso('ver_compras'), async (req, res) => {
    const idCompra = enteroPositivo(req.params.id);
    if (!idCompra) {
        return res.status(400).json({ mensaje: 'El id de compra no es válido' });
    }

    try {
        const params = [idCompra];
        let filtroSucursal = '';

        if (req.auth.usuario.id_sucursal && !req.auth.permisos?.has('gestionar_sucursales')) {
            params.push(req.auth.usuario.id_sucursal);
            filtroSucursal = `AND c.id_sucursal = $2`;
        }

        const compraRes = await pool.query(
            `SELECT c.*,
                    p.nombre AS proveedor_nombre,
                    p.nit AS proveedor_nit,
                    p.nrc AS proveedor_nrc,
                    s.nombre AS sucursal_nombre
             FROM compra c
             INNER JOIN proveedor p ON p.id_proveedor = c.id_proveedor
             INNER JOIN sucursal s ON s.id_sucursal = c.id_sucursal
             WHERE c.id_compra = $1 ${filtroSucursal}`,
            params
        );

        const compra = compraRes.rows[0];
        if (!compra) {
            return res.status(404).json({ mensaje: 'Compra no encontrada' });
        }

        const [detallesRes, cuentaRes] = await Promise.all([
            pool.query(
                `SELECT cd.*,
                        i.nombre AS insumo_nombre,
                        u.abreviatura AS unidad_abreviatura
                 FROM compra_detalle cd
                 INNER JOIN insumo i ON i.id_insumo = cd.id_insumo
                 INNER JOIN unidad_medida u ON u.id_unidad = i.id_unidad
                 WHERE cd.id_compra = $1
                 ORDER BY cd.id_compra_detalle`,
                [idCompra]
            ),
            pool.query(
                `SELECT * FROM cuenta_por_pagar WHERE id_compra = $1`,
                [idCompra]
            )
        ]);

        const cuentaPorPagar = cuentaRes.rows[0] ?? null;
        let pagos = [];

        if (cuentaPorPagar) {
            const pagosRes = await pool.query(
                `SELECT * FROM pago_proveedor WHERE id_cuenta = $1 ORDER BY fecha DESC`,
                [cuentaPorPagar.id_cuenta]
            );
            pagos = pagosRes.rows;
        }

        return res.json({
            ...compra,
            detalles: detallesRes.rows,
            cuenta_por_pagar: cuentaPorPagar ? { ...cuentaPorPagar, pagos } : null
        });
    } catch (error) {
        console.error('Error al consultar compra:', error);
        return res.status(500).json({ mensaje: 'No se pudo consultar la compra' });
    }
});

router.post('/', requerirPermiso('registrar_compras'), async (req, res) => {
    const {
        id_proveedor,
        id_sucursal: sucursalSolicitada,
        numero_documento,
        fecha_compra,
        condicion_pago,
        fecha_vencimiento,
        iva = 0,
        detalles
    } = req.body ?? {};

    const idProveedor = enteroPositivo(id_proveedor);
    const idSucursal = leerSucursal(req, sucursalSolicitada);
    const condicion = String(condicion_pago ?? '').trim().toUpperCase();
    const impuestoEntrada = Number(iva);
    const impuesto = redondear(impuestoEntrada);

    if (
        !idProveedor ||
        !enteroPositivo(idSucursal) ||
        typeof numero_documento !== 'string' || !numero_documento.trim() || numero_documento.length > 40 ||
        !esFechaValida(fecha_compra) ||
        !CONDICIONES_PAGO.has(condicion) ||
        !Array.isArray(detalles) || detalles.length === 0 || detalles.length > 100 ||
        !Number.isFinite(impuestoEntrada) || impuestoEntrada < 0 || impuesto > MAXIMO_DINERO
    ) {
        return res.status(400).json({ mensaje: 'Revisa los datos generales de la compra' });
    }

    if (condicion === 'CREDITO' && !esFechaValida(fecha_vencimiento)) {
        return res.status(400).json({
            mensaje: 'Las compras a CREDITO requieren una fecha_vencimiento válida (YYYY-MM-DD)'
        });
    }

    if (condicion === 'CREDITO' && fecha_vencimiento < fecha_compra) {
        return res.status(400).json({
            mensaje: 'La fecha de vencimiento no puede ser anterior a la fecha de compra'
        });
    }

    const insumosPorId = new Map();
    for (const [indice, item] of detalles.entries()) {
        const idInsumo = enteroPositivo(item?.id_insumo);
        const cantidad = Number(item?.cantidad);
        const costoUnitario = Number(item?.costo_unitario);

        if (
            !idInsumo ||
            !Number.isFinite(cantidad) || cantidad <= 0 || redondear(cantidad, 3) <= 0 ||
            !Number.isFinite(costoUnitario) || costoUnitario < 0 ||
            cantidad > 99999999.999 || costoUnitario > 9999999.9999 ||
            insumosPorId.has(idInsumo)
        ) {
            return res.status(400).json({
                mensaje: `El detalle ${indice + 1} no es válido o tiene un insumo duplicado`
            });
        }

        insumosPorId.set(idInsumo, {
            id_insumo: idInsumo,
            cantidad: redondear(cantidad, 3),
            costo_unitario: redondear(costoUnitario, 4)
        });
    }

    const detallesNormalizados = Array.from(insumosPorId.values());
    const subtotal = redondear(
        detallesNormalizados.reduce((acc, d) => acc + d.cantidad * d.costo_unitario, 0)
    );
    const total = redondear(subtotal + impuesto);

    if (subtotal > MAXIMO_DINERO || total > MAXIMO_DINERO) {
        return res.status(400).json({ mensaje: 'Los montos superan el límite permitido' });
    }

    const client = await pool.connect();
    let transaccionIniciada = false;

    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        transaccionIniciada = true;

        // 1. Verificar proveedor y sucursal activos
        const [provRes, sucRes] = await Promise.all([
            client.query(
                'SELECT id_proveedor FROM proveedor WHERE id_proveedor = $1 AND activo = TRUE',
                [idProveedor]
            ),
            client.query(
                'SELECT id_sucursal FROM sucursal WHERE id_sucursal = $1 AND activa = TRUE',
                [idSucursal]
            )
        ]);

        if (provRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'El proveedor no existe o está inactivo' });
        }
        if (sucRes.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'La sucursal no existe o está inactiva' });
        }

        const idsInsumos = detallesNormalizados.map((d) => d.id_insumo);
        const insumosRes = await client.query(
            `SELECT i.id_insumo,
                    i.costo_promedio,
                    COALESCE(SUM(inv.existencia), 0) AS existencia_global
             FROM insumo i
             LEFT JOIN inventario_sucursal inv ON inv.id_insumo = i.id_insumo
             WHERE i.id_insumo = ANY($1::int[]) AND i.activo = TRUE
             GROUP BY i.id_insumo, i.costo_promedio
             FOR UPDATE OF i`,
            [idsInsumos]
        );

        if (insumosRes.rowCount !== detallesNormalizados.length) {
            await client.query('ROLLBACK');
            return res.status(400).json({ mensaje: 'Uno o más insumos no existen o están inactivos' });
        }

        const mapaInsumos = new Map(
            insumosRes.rows.map((row) => [row.id_insumo, row])
        );

        const compraInsert = await client.query(
            `INSERT INTO compra (
                id_proveedor, id_sucursal, id_usuario, numero_documento,
                fecha_compra, condicion_pago, subtotal, iva, total, estado
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'REGISTRADA')
             RETURNING *`,
            [
                idProveedor,
                idSucursal,
                req.auth.usuario.id_usuario,
                numero_documento.trim(),
                fecha_compra,
                condicion,
                subtotal,
                impuesto,
                total
            ]
        );
        const compraCreada = compraInsert.rows[0];

        for (const det of detallesNormalizados) {
            await client.query(
                `INSERT INTO compra_detalle (id_compra, id_insumo, cantidad, costo_unitario)
                 VALUES ($1, $2, $3, $4)`,
                [compraCreada.id_compra, det.id_insumo, det.cantidad, det.costo_unitario]
            );

            //hacemos una suma del inventario de la sucursal
            await client.query(
                `INSERT INTO inventario_sucursal (id_sucursal, id_insumo, existencia)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (id_sucursal, id_insumo)
                 DO UPDATE SET existencia = inventario_sucursal.existencia + EXCLUDED.existencia`,
                [idSucursal, det.id_insumo, det.cantidad]
            );

            // se vuelve a calcular el costo promedioen insumo
            const infoInsumo = mapaInsumos.get(det.id_insumo);
            const stockAnterior = Number(infoInsumo.existencia_global);
            const costoAnterior = Number(infoInsumo.costo_promedio);
            const stockNuevo = stockAnterior + det.cantidad;

            const nuevoCostoPromedio = stockNuevo > 0
                ? redondear(
                    (stockAnterior * costoAnterior + det.cantidad * det.costo_unitario) / stockNuevo,
                    4
                )
                : det.costo_unitario;

            await client.query(
                `UPDATE insumo SET costo_promedio = $1 WHERE id_insumo = $2`,
                [nuevoCostoPromedio, det.id_insumo]
            );

            // Registrar movimiento en el historial de inventario
            await client.query(
                `INSERT INTO movimiento_inventario (
                    id_sucursal, id_insumo, id_usuario, tipo_movimiento,
                    cantidad, referencia, id_referencia
                 )
                 VALUES ($1, $2, $3, 'COMPRA', $4, 'COMPRA', $5)`,
                [
                    idSucursal,
                    det.id_insumo,
                    req.auth.usuario.id_usuario,
                    det.cantidad,
                    compraCreada.id_compra
                ]
            );
        }

        // 5. Si la compra es a CREDITO, crear la cuenta por pagar
        let cuentaPorPagar = null;
        if (condicion === 'CREDITO') {
            const cppRes = await client.query(
                `INSERT INTO cuenta_por_pagar (
                    id_compra, monto_original, saldo, fecha_vencimiento, estado
                 )
                 VALUES ($1, $2, $2, $3, 'PENDIENTE')
                 RETURNING *`,
                [compraCreada.id_compra, total, fecha_vencimiento]
            );
            cuentaPorPagar = cppRes.rows[0];
        }

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            mensaje: 'Compra registrada e inventario actualizado',
            compra: compraCreada,
            cuenta_por_pagar: cuentaPorPagar
        });
    } catch (error) {
        if (transaccionIniciada) {
            try {
                await client.query('ROLLBACK');
            } catch (rbError) {
                console.error('Error al revertir compra:', rbError);
            }
        }

        // Violación de constraint uq_compra_doc (id_proveedor, numero_documento)
        if (error.code === '23505') {
            return res.status(409).json({
                mensaje: 'Ya existe una compra registrada con ese número de documento para este proveedor'
            });
        }

        console.error('Error al registrar compra:', error);
        return res.status(500).json({ mensaje: 'No se pudo registrar la compra' });
    } finally {
        client.release();
    }
});

export default router;