import { query } from '../config/db.js';

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/parametros-legales
export async function listarParametros(req, res, next) {
  try {
    const resultado = await query(
      'SELECT clave, valor, descripcion, vigente_desde FROM parametro_legal ORDER BY clave'
    );
    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}

// PUT /api/parametros-legales/:clave   body: { valor, vigente_desde? }
// Los cambios solo afectan a las planillas que se generen DESPUÉS: las anteriores
// guardan los valores ya calculados.
export async function actualizarParametro(req, res, next) {
  try {
    const { clave } = req.params;
    const { valor, vigente_desde } = req.body;

    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ ok: false, mensaje: 'valor debe ser un número mayor o igual a 0' });
    }
    if (clave.endsWith('_PORCENTAJE') && valor > 1) {
      return res.status(400).json({ ok: false, mensaje: 'Un porcentaje se escribe como decimal (por ejemplo 0.03 para 3%)' });
    }
    if (vigente_desde !== undefined && !REGEX_FECHA.test(vigente_desde)) {
      return res.status(400).json({ ok: false, mensaje: 'vigente_desde debe tener el formato AAAA-MM-DD' });
    }

    const resultado = await query(
      `UPDATE parametro_legal
       SET valor = $1, vigente_desde = COALESCE($2::date, CURRENT_DATE)
       WHERE clave = $3
       RETURNING clave, valor, descripcion, vigente_desde`,
      [valor, vigente_desde ?? null, clave]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Parámetro no encontrado' });
    }
    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    if (err.code === '22007' || err.code === '22008') {
      return res.status(400).json({ ok: false, mensaje: 'La fecha no es válida' });
    }
    next(err);
  }
}

// GET /api/tramos-renta
export async function listarTramos(req, res, next) {
  try {
    const resultado = await query(
      `SELECT id_tramo, periodicidad, tramo, desde, hasta, porcentaje_exceso, sobre_exceso, cuota_fija
       FROM tramo_renta
       ORDER BY periodicidad, tramo`
    );
    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}