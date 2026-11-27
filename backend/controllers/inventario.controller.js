import { query, withTransaction } from '../config/db.js';

const TIPOS_VALIDOS = ['COMPRA', 'VENTA', 'AJUSTE', 'ANULACION'];

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const esNumeroDistintoDeCero = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor !== 0;

// Valida el body de POST. Devuelve un mensaje de error, o null si todo está bien.
function validarMovimiento(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo de la petición debe ser un objeto JSON válido';
  }

  const { id_sucursal, id_insumo, tipo_movimiento, cantidad, referencia, id_referencia } = body;

  if (!esIdValido(id_sucursal)) {
    return 'id_sucursal es obligatorio y debe ser un número entero positivo';
  }

  if (!esIdValido(id_insumo)) {
    return 'id_insumo es obligatorio y debe ser un número entero positivo';
  }

  if (typeof tipo_movimiento !== 'string' || !TIPOS_VALIDOS.includes(tipo_movimiento)) {
    return `tipo_movimiento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}`;
  }

  if (!esNumeroDistintoDeCero(cantidad)) {
    return 'cantidad es obligatoria, debe ser numérica y distinta de 0 (positivo entra, negativo sale)';
  }

  if (tipo_movimiento === 'COMPRA' && cantidad <= 0) {
    return 'Para tipo_movimiento COMPRA la cantidad debe ser positiva';
  }

  if (tipo_movimiento === 'VENTA' && cantidad >= 0) {
    return 'Para tipo_movimiento VENTA la cantidad debe ser negativa';
  }

  if (referencia !== undefined && referencia !== null) {
    if (typeof referencia !== 'string' || referencia.trim().length > 30) {
      return 'referencia debe ser un texto de máximo 30 caracteres';
    }
  }

  if (id_referencia !== undefined && id_referencia !== null && !esIdValido(id_referencia)) {
    return 'id_referencia debe ser un número entero positivo';
  }

  return null;
}

// Traduce los errores de PostgreSQL a respuestas HTTP claras
function obtenerCodigoError(err) {
  return err?.code || err?.cause?.code || null;
}

function responderErrorBD(err, res, next) {
  const codigo = obtenerCodigoError(err);

  if (codigo === '23503') {
    return res.status(400).json({ ok: false, mensaje: 'La sucursal, el insumo o el usuario indicado no existe' });
  }
  if (codigo === '23514') {
    return res.status(400).json({ ok: false, mensaje: 'El movimiento incumple una restricción de la base de datos' });
  }
  if (codigo === '22001') {
    return res.status(400).json({ ok: false, mensaje: 'Uno de los textos excede la longitud permitida' });
  }
  return next(err);
}


// GET /api/inventario?id_sucursal=1&id_insumo=2&buscar=cafe&bajo_stock=true
export async function listarStock(req, res, next) {
  try {
    const { id_sucursal, id_insumo, buscar, bajo_stock } = req.query;
    const condiciones = [];
    const valores = [];

    if (id_sucursal !== undefined && id_sucursal !== '') {
      if (!esIdValido(id_sucursal)) {
        return res.status(400).json({ ok: false, mensaje: 'id_sucursal debe ser un número válido' });
      }
      valores.push(Number(id_sucursal));
      condiciones.push(`s.id_sucursal = $${valores.length}`);
    }

    if (id_insumo !== undefined && id_insumo !== '') {
      if (!esIdValido(id_insumo)) {
        return res.status(400).json({ ok: false, mensaje: 'id_insumo debe ser un número válido' });
      }
      valores.push(Number(id_insumo));
      condiciones.push(`i.id_insumo = $${valores.length}`);
    }

    if (typeof buscar === 'string' && buscar.trim() !== '') {
      valores.push(`%${buscar.trim()}%`);
      const idx = valores.length;
      condiciones.push(`(i.nombre ILIKE $${idx} OR s.nombre ILIKE $${idx} OR u.abreviatura ILIKE $${idx})`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
    const having = bajo_stock === 'true' ? `HAVING COALESCE(SUM(mi.cantidad), 0) <= i.stock_minimo` : '';

    const resultado = await query(
      `SELECT s.id_sucursal, s.nombre AS sucursal,
              i.id_insumo, i.nombre AS insumo,
              u.nombre AS unidad_medida, u.abreviatura,
              i.stock_minimo,
              COALESCE(SUM(mi.cantidad), 0)::numeric(14,3) AS stock_actual
       FROM sucursal s
       CROSS JOIN insumo i
       JOIN unidad_medida u ON u.id_unidad = i.id_unidad
       LEFT JOIN movimiento_inventario mi
         ON mi.id_sucursal = s.id_sucursal AND mi.id_insumo = i.id_insumo
       ${where}
       GROUP BY s.id_sucursal, s.nombre, i.id_insumo, i.nombre, u.nombre, u.abreviatura, i.stock_minimo
       ${having}
       ORDER BY s.nombre ASC, i.nombre ASC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}


// GET /api/inventario/movimientos?id_sucursal=1&id_insumo=2&tipo_movimiento=AJUSTE
export async function listarMovimientos(req, res, next) {
  try {
    const { id_sucursal, id_insumo, tipo_movimiento } = req.query;
    const condiciones = [];
    const valores = [];

    if (id_sucursal !== undefined && id_sucursal !== '') {
      if (!esIdValido(id_sucursal)) {
        return res.status(400).json({ ok: false, mensaje: 'id_sucursal debe ser un número válido' });
      }
      valores.push(Number(id_sucursal));
      condiciones.push(`mi.id_sucursal = $${valores.length}`);
    }

    if (id_insumo !== undefined && id_insumo !== '') {
      if (!esIdValido(id_insumo)) {
        return res.status(400).json({ ok: false, mensaje: 'id_insumo debe ser un número válido' });
      }
      valores.push(Number(id_insumo));
      condiciones.push(`mi.id_insumo = $${valores.length}`);
    }

    if (tipo_movimiento !== undefined && tipo_movimiento !== '') {
      if (!TIPOS_VALIDOS.includes(tipo_movimiento)) {
        return res.status(400).json({ ok: false, mensaje: `tipo_movimiento debe ser uno de: ${TIPOS_VALIDOS.join(', ')}` });
      }
      valores.push(tipo_movimiento);
      condiciones.push(`mi.tipo_movimiento = $${valores.length}`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT mi.id_movimiento, mi.id_sucursal, s.nombre AS sucursal,
              mi.id_insumo, i.nombre AS insumo, u.abreviatura,
              mi.id_usuario, mi.tipo_movimiento, mi.cantidad,
              mi.referencia, mi.id_referencia, mi.fecha
       FROM movimiento_inventario mi
       JOIN sucursal s ON s.id_sucursal = mi.id_sucursal
       JOIN insumo i ON i.id_insumo = mi.id_insumo
       JOIN unidad_medida u ON u.id_unidad = i.id_unidad
       ${where}
       ORDER BY mi.fecha DESC, mi.id_movimiento DESC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}


// POST /api/inventario/movimientos
export async function registrarMovimiento(req, res, next) {
  try {
    const error = validarMovimiento(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const { id_sucursal, id_insumo, tipo_movimiento, cantidad, referencia, id_referencia } = req.body;
    const idSucursalNum = Number(id_sucursal);
    const idInsumoNum = Number(id_insumo);
    const idUsuario = req.usuario?.id_usuario ?? req.user?.id_usuario ?? null;

    const creado = await withTransaction(async (client) => {
      const resStock = await client.query(
        `SELECT COALESCE(SUM(cantidad), 0)::numeric(14,3) AS stock_actual
         FROM movimiento_inventario
         WHERE id_sucursal = $1 AND id_insumo = $2`,
        [idSucursalNum, idInsumoNum]
      );

      const stockActual = Number(resStock.rows[0].stock_actual);
      const stockResultante = Number((stockActual + Number(cantidad)).toFixed(3));

      if (stockResultante < 0) {
        const errNegativo = new Error('El movimiento dejaría el stock en negativo');
        errNegativo.statusCode = 400;
        throw errNegativo;
      }

      const resInsert = await client.query(
        `INSERT INTO movimiento_inventario
           (id_sucursal, id_insumo, id_usuario, tipo_movimiento, cantidad, referencia, id_referencia)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          idSucursalNum,
          idInsumoNum,
          idUsuario,
          tipo_movimiento,
          cantidad,
          typeof referencia === 'string' && referencia.trim() !== '' ? referencia.trim() : null,
          id_referencia ?? null
        ]
      );

      return {
        movimiento: resInsert.rows[0],
        stock_actual: stockResultante
      };
    });

    res.status(201).json({ ok: true, data: creado });
  } catch (err) {
    const status = err?.statusCode || err?.cause?.statusCode;
    if (status === 400) {
      return res.status(400).json({ ok: false, mensaje: err.message });
    }
    responderErrorBD(err, res, next);
  }
}