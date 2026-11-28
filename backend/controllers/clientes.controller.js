import { query } from '../config/db.js';

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoLimpio = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function obtenerCodigoError(err) {
  return err?.code || err?.cause?.code || null;
}

function responderErrorBD(err, res, next) {
  const codigo = obtenerCodigoError(err);

  if (codigo === '23505') {
    return res.status(409).json({
      ok: false,
      mensaje: 'Ya existe un cliente registrado con esos datos únicos'
    });
  }
  if (codigo === '22001') {
    return res.status(400).json({
      ok: false,
      mensaje: 'Uno o más campos exceden la longitud máxima permitida'
    });
  }
  return next(err);
}

// GET /api/clientes
export async function listarClientes(req, res, next) {
  try {
    const { buscar, contribuyente } = req.query;
    const condiciones = [];
    const valores = [];

    if (contribuyente === 'true' || contribuyente === 'false') {
      valores.push(contribuyente === 'true');
      condiciones.push(`es_contribuyente = $${valores.length}`);
    }

    if (typeof buscar === 'string' && buscar.trim() !== '') {
      valores.push(`%${buscar.trim()}%`);
      const idx = valores.length;
      condiciones.push(
        `(nombre ILIKE $${idx} OR COALESCE(nit, '') ILIKE $${idx} OR COALESCE(nrc, '') ILIKE $${idx} OR COALESCE(dui, '') ILIKE $${idx})`
      );
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT id_cliente, nombre, nit, nrc, dui, email, giro, direccion, es_contribuyente
       FROM cliente
       ${where}
       ORDER BY id_cliente DESC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}

// POST /api/clientes
export async function crearCliente(req, res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El cuerpo de la petición debe ser un objeto JSON válido'
      });
    }

    const nombre = textoLimpio(body.nombre);
    const nit = textoLimpio(body.nit) || null;
    const nrc = textoLimpio(body.nrc) || null;
    const dui = textoLimpio(body.dui) || null;
    const email = textoLimpio(body.email) || null;
    const giro = textoLimpio(body.giro) || null;
    const direccion = textoLimpio(body.direccion) || null;
    const esContribuyente = Boolean(body.es_contribuyente);

    if (!nombre) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El nombre o razón social del cliente es obligatorio'
      });
    }

    if (esContribuyente && !nrc) {
      return res.status(400).json({
        ok: false,
        mensaje: 'El NRC es obligatorio para clientes contribuyentes (CCF)'
      });
    }

    const resultado = await query(
      `INSERT INTO cliente (nombre, nit, nrc, dui, email, giro, direccion, es_contribuyente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id_cliente, nombre, nit, nrc, dui, email, giro, direccion, es_contribuyente`,
      [nombre, nit, nrc, dui, email, giro, direccion, esContribuyente]
    );

    res.status(201).json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}