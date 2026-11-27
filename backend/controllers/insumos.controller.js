import { query } from '../config/db.js';

const MAX_NOMBRE = 100;

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';
const esNumeroNoNegativo = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;

// Valida el body de POST y PUT. Devuelve un mensaje de error, o null si todo está bien.
function validarInsumo(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo de la petición debe ser un objeto JSON válido';
  }

  const { nombre, id_unidad, costo_promedio, stock_minimo } = body;

  if (typeof nombre !== 'string' || !textoValido(nombre)) {
    return 'El nombre del insumo es obligatorio y debe ser texto válido';
  }

  if (nombre.trim().length > MAX_NOMBRE) {
    return `El nombre del insumo no puede exceder los ${MAX_NOMBRE} caracteres`;
  }

  if (!esIdValido(id_unidad)) {
    return 'id_unidad es obligatorio y debe ser un número entero positivo';
  }

  if (costo_promedio !== undefined && !esNumeroNoNegativo(costo_promedio)) {
    return 'costo_promedio debe ser un número mayor o igual a 0';
  }

  if (stock_minimo !== undefined && !esNumeroNoNegativo(stock_minimo)) {
    return 'stock_minimo debe ser un número mayor o igual a 0';
  }

  return null;
}

// Traduce los errores de PostgreSQL a respuestas HTTP claras
function obtenerCodigoError(err) {
  return err?.code || err?.cause?.code || null;
}

function responderErrorBD(err, res, next) {
  const codigo = obtenerCodigoError(err);

  if (codigo === '23505') {
    return res.status(409).json({ ok: false, mensaje: 'Ya existe un insumo con ese nombre' });
  }
  if (codigo === '23503') {
    return res.status(400).json({ ok: false, mensaje: 'La unidad de medida indicada no existe' });
  }
  if (codigo === '22001') {
    return res.status(400).json({ ok: false, mensaje: `El nombre no puede exceder los ${MAX_NOMBRE} caracteres` });
  }
  return next(err);
}


// GET /api/insumos?activo=true|false&buscar=texto
export async function listarInsumos(req, res, next) {
  try {
    const { activo, buscar } = req.query;
    const condiciones = [];
    const valores = [];

    if (activo === 'true' || activo === 'false') {
      valores.push(activo === 'true');
      condiciones.push(`i.activo = $${valores.length}`);
    }

    if (typeof buscar === 'string' && buscar.trim() !== '') {
      valores.push(`%${buscar.trim()}%`);
      const idx = valores.length;
      condiciones.push(`(i.nombre ILIKE $${idx} OR u.nombre ILIKE $${idx} OR u.abreviatura ILIKE $${idx})`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT i.id_insumo, i.nombre, i.id_unidad, u.nombre AS unidad_medida, u.abreviatura,
              i.costo_promedio, i.stock_minimo, i.activo
       FROM insumo i
       JOIN unidad_medida u ON u.id_unidad = i.id_unidad
       ${where}
       ORDER BY i.nombre ASC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}


// GET /api/insumos/:id
export async function obtenerInsumo(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const resultado = await query(
      `SELECT i.id_insumo, i.nombre, i.id_unidad, u.nombre AS unidad_medida, u.abreviatura,
              i.costo_promedio, i.stock_minimo, i.activo
       FROM insumo i
       JOIN unidad_medida u ON u.id_unidad = i.id_unidad
       WHERE i.id_insumo = $1`,
      [Number(id)]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Insumo no encontrado' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    next(err);
  }
}


// POST /api/insumos
export async function crearInsumo(req, res, next) {
  try {
    const error = validarInsumo(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const { nombre, id_unidad, costo_promedio = 0, stock_minimo = 0 } = req.body;

    const resultado = await query(
      `INSERT INTO insumo (nombre, id_unidad, costo_promedio, stock_minimo)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre.trim(), Number(id_unidad), costo_promedio, stock_minimo]
    );

    res.status(201).json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}

// PUT /api/insumos/:id
export async function actualizarInsumo(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const error = validarInsumo(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const { nombre, id_unidad, costo_promedio, stock_minimo, activo } = req.body;

    if (activo !== undefined && typeof activo !== 'boolean') {
      return res.status(400).json({ ok: false, mensaje: 'activo debe ser un valor booleano' });
    }

    const resultado = await query(
      `UPDATE insumo
       SET nombre = $1,
           id_unidad = $2,
           costo_promedio = COALESCE($3, costo_promedio),
           stock_minimo = COALESCE($4, stock_minimo),
           activo = COALESCE($5, activo)
       WHERE id_insumo = $6
       RETURNING *`,
      [
        nombre.trim(),
        Number(id_unidad),
        costo_promedio ?? null,
        stock_minimo ?? null,
        activo ?? null,
        Number(id)
      ]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Insumo no encontrado' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}

// DELETE /api/insumos/:id (baja lógica)
export async function darDeBajaInsumo(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const resultado = await query(
      `UPDATE insumo
       SET activo = false
       WHERE id_insumo = $1
       RETURNING id_insumo, activo`,
      [Number(id)]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Insumo no encontrado' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    next(err);
  }
}