import { query } from '../config/db.js';

const MAX_NOMBRE = 60;
const CONTIENE_NUMEROS = /\d/;

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';

// Valida el body de POST y PUT. Devuelve un mensaje de error, o null si todo está bien.
function validarCategoria(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo de la petición debe ser un objeto JSON válido';
  }

  const { nombre } = body;

  if (typeof nombre !== 'string' || !textoValido(nombre)) {
    return 'El nombre de la categoría es obligatorio y debe ser una cadena de texto válida';
  }

  const nombreLimpio = nombre.trim();

  if (nombreLimpio.length > MAX_NOMBRE) {
    return `El nombre de la categoría no puede exceder los ${MAX_NOMBRE} caracteres`;
  }

  if (CONTIENE_NUMEROS.test(nombreLimpio)) {
    return 'El nombre de la categoría no puede contener números';
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
    return res.status(409).json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre' });
  }
  if (codigo === '22001') {
    return res.status(400).json({ ok: false, mensaje: `El nombre no puede exceder los ${MAX_NOMBRE} caracteres` });
  }
  return next(err);
}


//GET /api/categorias
//dado que req jamas se utiliza, por convencion se declara de la forma _req
export async function listarCategorias(_req, res, next) {
    try{
        const resultado = await query(
            `SELECT id_categoria, nombre
            FROM categoria
            ORDER BY nombre ASC`
        );
        res.json({ok: true, data: resultado.rows});
    } catch(err){
        next(err);
    }
}

//POST /api/categorias
export async function crearCategoria(req, res, next) {
    try {
    const error = validarCategoria(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const nombre = req.body.nombre.trim();

    const resultado = await query(
      `INSERT INTO categoria (nombre)
       VALUES ($1)
       RETURNING id_categoria, nombre`,
      [nombre]
    );

    res.status(201).json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}

//PUT /api/categorias/:id
export async function actualizarCategoria(req, res, next) {
    try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const error = validarCategoria(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const nombre = req.body.nombre.trim();

    const resultado = await query(
      `UPDATE categoria
       SET nombre = $1
       WHERE id_categoria = $2
       RETURNING id_categoria, nombre`,
      [nombre, Number(id)]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}