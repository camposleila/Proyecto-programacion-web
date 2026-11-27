import { query, withTransaction } from '../config/db.js';

const MAX_NOMBRE = 120;

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const textoValido = (valor) => typeof valor === 'string' && valor.trim() !== '';
const esNumeroNoNegativo = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
const esCantidadPositiva = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor > 0;

// Valida el body de POST y PUT. Devuelve un mensaje de error, o null si todo está bien.
function validarReceta(receta) {
  if (!Array.isArray(receta)) {
    return 'receta debe ser un arreglo';
  }

  for (let i = 0; i < receta.length; i += 1) {
    const item = receta[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `El elemento ${i + 1} de receta debe ser un objeto válido`;
    }
    if (!esIdValido(item.id_insumo)) {
      return `id_insumo en el elemento ${i + 1} de receta debe ser un entero positivo`;
    }
    if (!esCantidadPositiva(item.cantidad)) {
      return `cantidad en el elemento ${i + 1} de receta debe ser mayor que 0`;
    }
  }

  return null;
}

function validarProducto(body, { esActualizacion = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo de la petición debe ser un objeto JSON válido';
  }

  const { nombre, id_categoria, tipo_producto, precio_venta, activo, receta } = body;

    if (typeof tipo_producto !== 'string' || !textoValido(tipo_producto)) {
    return 'tipo_producto es obligatorio y debe ser texto válido';
  }

  if (typeof nombre !== 'string' || !textoValido(nombre)) {
    return 'El nombre del producto es obligatorio y debe ser texto válido';
  }

  if (nombre.trim().length > MAX_NOMBRE) {
    return `El nombre del producto no puede exceder los ${MAX_NOMBRE} caracteres`;
  }

  if (!esIdValido(id_categoria)) {
    return 'id_categoria es obligatorio y debe ser un número entero positivo';
  }

  if (!esNumeroNoNegativo(precio_venta)) {
    return 'precio_venta es obligatorio y debe ser un número mayor o igual a 0';
  }

  if (esActualizacion && activo !== undefined && typeof activo !== 'boolean') {
    return 'activo debe ser un valor booleano';
  }

  if (receta !== undefined) {
    const errorReceta = validarReceta(receta);
    if (errorReceta) return errorReceta;
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
    return res.status(409).json({ ok: false, mensaje: 'Ya existe un producto con ese nombre' });
  }
  if (codigo === '23503') {
    return res.status(400).json({ ok: false, mensaje: 'La categoría o algún insumo indicado no existe' });
  }
  if (codigo === '22001') {
    return res.status(400).json({ ok: false, mensaje: `El nombre no puede exceder los ${MAX_NOMBRE} caracteres` });
  }
  return next(err);
}

//Funciones auxiliares: la primera guarda la receta en una transaccion, la segunda lee la receta y consulta los ingredientes.
async function guardarReceta(client, idProducto, receta) {
  await client.query(`DELETE FROM receta_detalle WHERE id_producto = $1`, [idProducto]);

  for (const item of receta) {
    await client.query(
      `INSERT INTO receta_detalle (id_producto, id_insumo, cantidad)
       VALUES ($1, $2, $3)`,
      [idProducto, Number(item.id_insumo), item.cantidad]
    );
  }
}

async function consultarRecetaPorProducto(idProducto) {
  const resReceta = await query(
    `SELECT rd.id_insumo, i.nombre AS insumo,
            u.nombre AS unidad_medida, u.abreviatura, rd.cantidad
     FROM receta_detalle rd
     JOIN insumo i ON i.id_insumo = rd.id_insumo
     JOIN unidad_medida u ON u.id_unidad = i.id_unidad
     WHERE rd.id_producto = $1
     ORDER BY rd.id_insumo ASC`,
    [idProducto]
  );
  return resReceta.rows;
}

// GET /api/productos?activo=true|false&id_categoria=1&buscar=cafe
export async function listarProductos(req, res, next) {
  try {
    const { activo, id_categoria, buscar } = req.query;
    const condiciones = [];
    const valores = [];

    if (activo === 'true' || activo === 'false') {
      valores.push(activo === 'true');
      condiciones.push(`p.activo = $${valores.length}`);
    }

    if (id_categoria !== undefined && id_categoria !== '') {
      if (!esIdValido(id_categoria)) {
        return res.status(400).json({ ok: false, mensaje: 'id_categoria debe ser un número válido' });
      }
      valores.push(Number(id_categoria));
      condiciones.push(`p.id_categoria = $${valores.length}`);
    }

    if (typeof buscar === 'string' && buscar.trim() !== '') {
      valores.push(`%${buscar.trim()}%`);
      const idx = valores.length;
      condiciones.push(`(p.nombre ILIKE $${idx} OR c.nombre ILIKE $${idx})`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT p.id_producto, p.id_categoria, c.nombre AS categoria,
              p.nombre, p.precio_venta, p.activo
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       ${where}
       ORDER BY p.nombre ASC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/productos/:id
export async function obtenerProducto(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const resultado = await query(
      `SELECT p.id_producto, p.id_categoria, c.nombre AS categoria,
              p.nombre, p.precio_venta, p.activo
       FROM producto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
       WHERE p.id_producto = $1`,
      [Number(id)]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    }

    const receta = await consultarRecetaPorProducto(Number(id));

    res.json({
      ok: true,
      data: {
        ...resultado.rows[0],
        receta
      }
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/productos
export async function crearProducto(req, res, next) {
  try {
    const error = validarProducto(req.body);
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const { nombre, id_categoria, tipo_producto, precio_venta, receta } = req.body;

  const creado = await withTransaction(async (client) => {
  const resProd = await client.query(
    `INSERT INTO producto (id_categoria, tipo_producto, nombre, precio_venta)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [Number(id_categoria), tipo_producto.trim(), nombre.trim(), precio_venta]
    );

    const producto = resProd.rows[0];

      if (Array.isArray(receta) && receta.length > 0) {
        await guardarReceta(client, producto.id_producto, receta);
      }

      return producto;
    });

    const recetaGuardada = await consultarRecetaPorProducto(creado.id_producto);

    res.status(201).json({
      ok: true,
      data: {
        ...creado,
        receta: recetaGuardada
      }
    });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}

// PUT /api/productos/:id
export async function actualizarProducto(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const error = validarProducto(req.body, { esActualizacion: true });
    if (error) {
      return res.status(400).json({ ok: false, mensaje: error });
    }

    const { nombre, id_categoria, precio_venta, activo, receta } = req.body;
    const idNum = Number(id);

    const actualizado = await withTransaction(async (client) => {
      const resProd = await client.query(
        `UPDATE producto
         SET id_categoria = $1,
             nombre = $2,
             precio_venta = $3,
             activo = COALESCE($4, activo)
         WHERE id_producto = $5
         RETURNING *`,
        [Number(id_categoria), nombre.trim(), precio_venta, activo ?? null, idNum]
      );

      if (resProd.rows.length === 0) {
        return null;
      }

      if (Array.isArray(receta)) {
        await guardarReceta(client, idNum, receta);
      }

      return resProd.rows[0];
    });

    if (!actualizado) {
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    }

    const recetaActualizada = await consultarRecetaPorProducto(idNum);

    res.json({
      ok: true,
      data: {
        ...actualizado,
        receta: recetaActualizada
      }
    });
  } catch (err) {
    responderErrorBD(err, res, next);
  }
}


// DELETE /api/productos/:id (baja lógica)
export async function darDeBajaProducto(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id debe ser un número válido' });
    }

    const resultado = await query(
      `UPDATE producto
       SET activo = false
       WHERE id_producto = $1
       RETURNING id_producto, activo`,
      [Number(id)]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Producto no encontrado' });
    }

    res.json({ ok: true, data: resultado.rows[0] });
  } catch (err) {
    next(err);
  }
}

