import { query, withTransaction } from '../config/db.js';

const TIPOS_DOCUMENTO = new Set(['FACTURA', 'CCF']);
const METODOS_PAGO = new Set(['EFECTIVO', 'TARJETA', 'BITCOIN', 'CHIVO']);

const esIdValido = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const esEnteroPositivo = (valor) => Number.isInteger(Number(valor)) && Number(valor) > 0;
const esNumeroNoNegativo = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
const esMontoPositivo = (valor) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor > 0;

function redondear2(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function redondear3(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 1000) / 1000;
}

function crearErrorNegocio(status, mensaje) {
  const err = new Error(mensaje);
  err.status = status;
  return err;
}

function validarPayloadVenta(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'El cuerpo de la petición debe ser un objeto JSON válido';
  }

  const {
    id_sucursal, id_turno,id_usuario, id_cliente, tipo_documento, serie, descuento = 0, items, pagos
  } = body;

  if (!esIdValido(id_sucursal)) {
    return 'id_sucursal es obligatorio y debe ser un entero positivo';
  }
  if (!esIdValido(id_turno)) {
    return 'id_turno es obligatorio y debe ser un entero positivo';
  }
  if (id_usuario !== undefined && id_usuario !== null && !esIdValido(id_usuario)) {
    return 'id_usuario debe ser un entero positivo';
  }
  if (id_cliente !== undefined && id_cliente !== null && !esIdValido(id_cliente)) {
    return 'id_cliente debe ser un entero positivo';
  }
  if (!TIPOS_DOCUMENTO.has(tipo_documento)) {
    return 'tipo_documento debe ser FACTURA o CCF';
  }
  if (serie !== undefined && serie !== null && (typeof serie !== 'string' || !serie.trim())) {
    return 'serie debe ser un texto válido';
  }
  if (!esNumeroNoNegativo(descuento)) {
    return 'descuento debe ser un número mayor o igual a 0';
  }

  if (!Array.isArray(items) || items.length === 0) {
    return 'items debe ser un arreglo con al menos un producto';
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return `El elemento ${i + 1} de items debe ser un objeto válido`;
    }
    if (!esIdValido(item.id_producto)) {
      return `id_producto en items[${i}] debe ser un entero positivo`;
    }
    if (!esEnteroPositivo(item.cantidad)) {
      return `cantidad en items[${i}] debe ser un entero mayor que 0`;
    }
  }

  if (!Array.isArray(pagos) || pagos.length === 0) {
    return 'pagos debe ser un arreglo con al menos un pago';
  }

  for (let i = 0; i < pagos.length; i += 1) {
    const pago = pagos[i];
    if (!pago || typeof pago !== 'object' || Array.isArray(pago)) {
      return `El elemento ${i + 1} de pagos debe ser un objeto válido`;
    }
    if (!METODOS_PAGO.has(pago.metodo_pago)) {
      return `metodo_pago en pagos[${i}] no es válido (${Array.from(METODOS_PAGO).join(', ')})`;
    }
    if (!esMontoPositivo(pago.monto)) {
      return `monto en pagos[${i}] debe ser mayor que 0`;
    }
    if (
      pago.referencia !== undefined &&
      pago.referencia !== null &&
      typeof pago.referencia !== 'string'
    ) {
      return `referencia en pagos[${i}] debe ser texto`;
    }
  }

  return null;
}

// POST /api/ventas
export async function crearVenta(req, res, next) {
  try {
    const errorValidacion = validarPayloadVenta(req.body);
    if (errorValidacion) {
      return res.status(400).json({ ok: false, mensaje: errorValidacion });
    }

    const idSucursal = Number(req.body.id_sucursal);
    const idTurno = Number(req.body.id_turno);
    const idUsuario = Number(req.usuario?.id_usuario || req.body.id_usuario);
    const idCliente = req.body.id_cliente ? Number(req.body.id_cliente) : null;
    const tipoDocumento = req.body.tipo_documento;
    const serieSolicitada = req.body.serie ? req.body.serie.trim() : null;
    const descuento = redondear2(req.body.descuento ?? 0);
    const items = req.body.items;
    const pagos = req.body.pagos;

    if (!esIdValido(idUsuario)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id_usuario es obligatorio (o debe venir autenticado en el token)'
      });
    }

    if (tipoDocumento === 'CCF' && !idCliente) {
      return res.status(400).json({
        ok: false,
        mensaje: 'id_cliente es obligatorio para emitir un CCF'
      });
    }

    const ventaCreada = await withTransaction(async (client) => {
      // 1. Verificar turno abierto en la sucursal
      const turnoRes = await client.query(
        `SELECT id_turno, id_caja, estado
         FROM turno_caja
         WHERE id_turno = $1
         FOR UPDATE`,
        [idTurno]
      );

      if (turnoRes.rows.length === 0) {
        throw crearErrorNegocio(404, 'El turno de caja indicado no existe');
      }

      const turno = turnoRes.rows[0];
      if (turno.estado !== 'ABIERTO') {
        throw crearErrorNegocio(400, 'El turno de caja no está ABIERTO');
      }

      const cajaRes = await client.query(
        `SELECT id_sucursal FROM caja WHERE id_caja = $1`,
        [turno.id_caja]
      );
      if (cajaRes.rows.length === 0 || Number(cajaRes.rows[0].id_sucursal) !== idSucursal) {
        throw crearErrorNegocio(400, 'El turno de caja no pertenece a la sucursal indicada');
      }

      // 2. Verificar usuario activo
      const usuarioRes = await client.query(
        `SELECT id_usuario, activo FROM usuario WHERE id_usuario = $1`,
        [idUsuario]
      );
      if (usuarioRes.rows.length === 0 || !usuarioRes.rows[0].activo) {
        throw crearErrorNegocio(400, 'El usuario indicado no existe o está inactivo');
      }

      // 3. Verificar cliente y regla de contribuyente para CCF
      let cliente = null;
      if (idCliente) {
        const clienteRes = await client.query(
          `SELECT id_cliente, nombre, nit, nrc, es_contribuyente
           FROM cliente
           WHERE id_cliente = $1`,
          [idCliente]
        );
        if (clienteRes.rows.length === 0) {
          throw crearErrorNegocio(404, 'El cliente indicado no existe');
        }
        cliente = clienteRes.rows[0];
      }

      if (tipoDocumento === 'CCF' && !cliente?.es_contribuyente) {
        throw crearErrorNegocio(
          400,
          'Para emitir un CCF el cliente debe estar registrado como contribuyente'
        );
      }

      // 4. Consolidar cantidades por producto y calcular líneas + consumo de insumos
      const cantidadPorProducto = new Map();
      for (const item of items) {
        const prodId = Number(item.id_producto);
        const cant = Number(item.cantidad);
        cantidadPorProducto.set(prodId, (cantidadPorProducto.get(prodId) || 0) + cant);
      }

      const lineasVenta = [];
      const insumoNecesario = new Map(); // id_insumo -> cantidad total a descontar
      let brutoItems = 0;

      for (const [idProducto, cantidadTotal] of cantidadPorProducto.entries()) {
        const prodRes = await client.query(
          `SELECT id_producto, nombre, tipo_producto, precio_venta, activo
           FROM producto
           WHERE id_producto = $1`,
          [idProducto]
        );

        if (prodRes.rows.length === 0) {
          throw crearErrorNegocio(404, `Producto con id ${idProducto} no encontrado`);
        }

        const prod = prodRes.rows[0];
        if (!prod.activo) {
          throw crearErrorNegocio(400, `El producto "${prod.nombre}" está inactivo`);
        }

        const recetaRes = await client.query(
          `SELECT rd.id_insumo, rd.cantidad, i.nombre AS nombre_insumo
           FROM receta_detalle rd
           JOIN insumo i ON i.id_insumo = rd.id_insumo
           WHERE rd.id_producto = $1`,
          [idProducto]
        );

        if (recetaRes.rows.length === 0) {
          throw crearErrorNegocio(
            400,
            `El producto "${prod.nombre}" no tiene receta configurada`
          );
        }

        for (const rec of recetaRes.rows) {
          const requerido = redondear3(Number(rec.cantidad) * cantidadTotal);
          const actual = insumoNecesario.get(rec.id_insumo) || {
            id_insumo: rec.id_insumo,
            nombre: rec.nombre_insumo,
            cantidad: 0
          };
          actual.cantidad = redondear3(actual.cantidad + requerido);
          insumoNecesario.set(rec.id_insumo, actual);
        }

        const precioUnitario = redondear2(prod.precio_venta);
        const totalLinea = redondear2(precioUnitario * cantidadTotal);
        brutoItems = redondear2(brutoItems + totalLinea);

        lineasVenta.push({
          id_producto: idProducto,
          cantidad: cantidadTotal,
          precio_unitario: precioUnitario,
          total_linea: totalLinea
        });
      }

      if (descuento > brutoItems) {
        throw crearErrorNegocio(400, 'El descuento no puede ser mayor al monto de los productos');
      }

      // 5. Validar y descontar inventario por sucursal (con bloqueo de fila)
      const insumosOrdenados = Array.from(insumoNecesario.values()).sort(
        (a, b) => a.id_insumo - b.id_insumo
      );

      for (const reqInsumo of insumosOrdenados) {
        const invRes = await client.query(
          `SELECT existencia
           FROM inventario_sucursal
           WHERE id_sucursal = $1 AND id_insumo = $2
           FOR UPDATE`,
          [idSucursal, reqInsumo.id_insumo]
        );

        const existenciaActual =
          invRes.rows.length > 0 ? Number(invRes.rows[0].existencia) : 0;

        if (existenciaActual < reqInsumo.cantidad) {
          throw crearErrorNegocio(
            409,
            `Stock insuficiente para el insumo "${reqInsumo.nombre}" (disponible: ${existenciaActual}, requerido: ${reqInsumo.cantidad})`
          );
        }

        await client.query(
          `UPDATE inventario_sucursal
           SET existencia = existencia - $1
           WHERE id_sucursal = $2 AND id_insumo = $3`,
          [reqInsumo.cantidad, idSucursal, reqInsumo.id_insumo]
        );
      }

      // 6. Calcular totales (precios con IVA incluido del 13%)
      const total = redondear2(brutoItems - descuento);
      const subtotal = redondear2(total / 1.13);
      const iva = redondear2(total - subtotal);

      // 7. Validar suma de pagos
      const totalPagos = redondear2(
        pagos.reduce((acc, p) => acc + redondear2(p.monto), 0)
      );

      if (totalPagos < total) {
        throw crearErrorNegocio(
          400,
          `El monto pagado (${totalPagos.toFixed(2)}) es menor al total de la venta (${total.toFixed(2)})`
        );
      }

      // 8. Obtener y avanzar correlativo de forma atómica
      const corrQuery = serieSolicitada
        ? `SELECT id_correlativo, serie, ultimo_numero
           FROM correlativo_documento
           WHERE id_sucursal = $1 AND tipo_documento = $2 AND serie = $3
           FOR UPDATE`
        : `SELECT id_correlativo, serie, ultimo_numero
           FROM correlativo_documento
           WHERE id_sucursal = $1 AND tipo_documento = $2
           ORDER BY id_correlativo ASC
           LIMIT 1
           FOR UPDATE`;

      const corrParams = serieSolicitada
        ? [idSucursal, tipoDocumento, serieSolicitada]
        : [idSucursal, tipoDocumento];

      const corrRes = await client.query(corrQuery, corrParams);
      if (corrRes.rows.length === 0) {
        throw crearErrorNegocio(
          400,
          `No existe correlativo configurado para ${tipoDocumento} en la sucursal ${idSucursal}`
        );
      }

      const correlativo = corrRes.rows[0];
      const numeroDocumento = Number(correlativo.ultimo_numero) + 1;
      const serieFinal = correlativo.serie;

      await client.query(
        `UPDATE correlativo_documento
         SET ultimo_numero = $1
         WHERE id_correlativo = $2`,
        [numeroDocumento, correlativo.id_correlativo]
      );

      // 9. Insertar cabecera de venta
      const ventaRes = await client.query(
        `INSERT INTO venta (
           id_sucursal, id_turno, id_usuario, id_cliente,
           tipo_documento, serie, numero_documento,
           descuento, subtotal, iva, total, estado
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'EMITIDA')
         RETURNING *`,
        [
          idSucursal,
          idTurno,
          idUsuario,
          idCliente,
          tipoDocumento,
          serieFinal,
          numeroDocumento,
          descuento,
          subtotal,
          iva,
          total
        ]
      );

      const venta = ventaRes.rows[0];

      // 10. Insertar detalle de venta
      for (const linea of lineasVenta) {
        await client.query(
          `INSERT INTO venta_detalle (id_venta, id_producto, cantidad, precio_unitario, total_linea)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            venta.id_venta,
            linea.id_producto,
            linea.cantidad,
            linea.precio_unitario,
            linea.total_linea
          ]
        );
      }

      // 11. Registrar movimientos de inventario por VENTA
      for (const reqInsumo of insumosOrdenados) {
        await client.query(
          `INSERT INTO movimiento_inventario (
             id_sucursal, id_insumo, id_usuario, tipo_movimiento,
             cantidad, referencia, id_referencia
           )
           VALUES ($1, $2, $3, 'VENTA', $4, 'VENTA', $5)`,
          [
            idSucursal,
            reqInsumo.id_insumo,
            idUsuario,
            -Math.abs(reqInsumo.cantidad),
            venta.id_venta
          ]
        );
      }

      // 12. Insertar pagos de venta
      const pagosInsertados = [];
      for (const pago of pagos) {
        const montoRedondeado = redondear2(pago.monto);
        const refLimpia = pago.referencia ? pago.referencia.trim() : null;
        const pagoRes = await client.query(
          `INSERT INTO venta_pago (id_venta, metodo_pago, monto, referencia)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [venta.id_venta, pago.metodo_pago, montoRedondeado, refLimpia]
        );
        pagosInsertados.push(pagoRes.rows[0]);
      }

      const vuelto = redondear2(Math.max(0, totalPagos - total));

      return {
        ...venta,
        cliente,
        vuelto,
        detalles: lineasVenta,
        pagos: pagosInsertados
      };
    });

    res.status(201).json({ ok: true, data: ventaCreada });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    next(err);
  }
}

// GET /api/ventas
export async function listarVentas(req, res, next) {
  try {
    const { id_sucursal, tipo_documento, estado, fecha_desde, fecha_hasta } = req.query;
    const condiciones = [];
    const valores = [];

    if (id_sucursal !== undefined && id_sucursal !== '') {
      if (!esIdValido(id_sucursal)) {
        return res.status(400).json({ ok: false, mensaje: 'id_sucursal debe ser un entero positivo' });
      }
      valores.push(Number(id_sucursal));
      condiciones.push(`v.id_sucursal = $${valores.length}`);
    }

    if (tipo_documento !== undefined && tipo_documento !== '') {
      if (!TIPOS_DOCUMENTO.has(tipo_documento)) {
        return res.status(400).json({ ok: false, mensaje: 'tipo_documento debe ser FACTURA o CCF' });
      }
      valores.push(tipo_documento);
      condiciones.push(`v.tipo_documento = $${valores.length}`);
    }

    if (estado !== undefined && estado !== '') {
      if (estado !== 'EMITIDA' && estado !== 'ANULADA') {
        return res.status(400).json({ ok: false, mensaje: 'estado debe ser EMITIDA o ANULADA' });
      }
      valores.push(estado);
      condiciones.push(`v.estado = $${valores.length}`);
    }

    if (typeof fecha_desde === 'string' && fecha_desde.trim() !== '') {
      valores.push(fecha_desde.trim());
      condiciones.push(`v.fecha >= $${valores.length}::timestamptz`);
    }

    if (typeof fecha_hasta === 'string' && fecha_hasta.trim() !== '') {
      valores.push(fecha_hasta.trim());
      condiciones.push(`v.fecha <= $${valores.length}::timestamptz`);
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const resultado = await query(
      `SELECT v.*,
              c.nombre AS cliente_nombre,
              c.nrc AS cliente_nrc,
              s.nombre AS sucursal_nombre
       FROM venta v
       LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
       JOIN sucursal s ON s.id_sucursal = v.id_sucursal
       ${where}
       ORDER BY v.fecha DESC, v.id_venta DESC`,
      valores
    );

    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/ventas/:id
export async function obtenerVenta(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id de venta debe ser un entero positivo' });
    }

    const idVenta = Number(id);

    const ventaRes = await query(
      `SELECT v.*,
              c.nombre AS cliente_nombre,
              c.nit AS cliente_nit,
              c.nrc AS cliente_nrc,
              c.dui AS cliente_dui,
              c.es_contribuyente,
              s.nombre AS sucursal_nombre
       FROM venta v
       LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
       JOIN sucursal s ON s.id_sucursal = v.id_sucursal
       WHERE v.id_venta = $1`,
      [idVenta]
    );

    if (ventaRes.rows.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Venta no encontrada' });
    }

    const [detallesRes, pagosRes] = await Promise.all([
      query(
        `SELECT vd.id_venta_detalle, vd.id_producto, p.nombre AS producto_nombre,
                vd.cantidad, vd.precio_unitario, vd.total_linea
         FROM venta_detalle vd
         JOIN producto p ON p.id_producto = vd.id_producto
         WHERE vd.id_venta = $1
         ORDER BY vd.id_venta_detalle ASC`,
        [idVenta]
      ),
      query(
        `SELECT id_venta_pago, metodo_pago, monto, referencia
         FROM venta_pago
         WHERE id_venta = $1
         ORDER BY id_venta_pago ASC`,
        [idVenta]
      )
    ]);

    res.json({
      ok: true,
      data: {
        ...ventaRes.rows[0],
        detalles: detallesRes.rows,
        pagos: pagosRes.rows
      }
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/ventas/:id/anular
export async function anularVenta(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res.status(400).json({ ok: false, mensaje: 'El id de venta debe ser un entero positivo' });
    }

    const idVenta = Number(id);
    const idUsuario = req.usuario?.id_usuario || req.body?.id_usuario || null;

    if (idUsuario !== null && !esIdValido(idUsuario)) {
      return res.status(400).json({ ok: false, mensaje: 'id_usuario debe ser un entero positivo' });
    }

    const ventaAnulada = await withTransaction(async (client) => {
      const ventaRes = await client.query(
        `SELECT *
         FROM venta
         WHERE id_venta = $1
         FOR UPDATE`,
        [idVenta]
      );

      if (ventaRes.rows.length === 0) {
        throw crearErrorNegocio(404, 'Venta no encontrada');
      }

      const venta = ventaRes.rows[0];
      if (venta.estado === 'ANULADA') {
        throw crearErrorNegocio(409, 'La venta ya se encuentra anulada');
      }

      const detallesRes = await client.query(
        `SELECT id_producto, cantidad
         FROM venta_detalle
         WHERE id_venta = $1`,
        [idVenta]
      );

      const insumoDevolver = new Map();

      for (const det of detallesRes.rows) {
        const recetaRes = await client.query(
          `SELECT id_insumo, cantidad
           FROM receta_detalle
           WHERE id_producto = $1`,
          [det.id_producto]
        );

        for (const rec of recetaRes.rows) {
          const devolverCant = redondear3(Number(rec.cantidad) * Number(det.cantidad));
          const prev = insumoDevolver.get(rec.id_insumo) || 0;
          insumoDevolver.set(rec.id_insumo, redondear3(prev + devolverCant));
        }
      }

      const insumosOrdenados = Array.from(insumoDevolver.entries()).sort(
        (a, b) => a[0] - b[0]
      );

      for (const [idInsumo, cantidadDevuelta] of insumosOrdenados) {
        await client.query(
          `INSERT INTO inventario_sucursal (id_sucursal, id_insumo, existencia)
           VALUES ($1, $2, $3)
           ON CONFLICT (id_sucursal, id_insumo)
           DO UPDATE SET existencia = inventario_sucursal.existencia + EXCLUDED.existencia`,
          [venta.id_sucursal, idInsumo, cantidadDevuelta]
        );

        await client.query(
          `INSERT INTO movimiento_inventario (
             id_sucursal, id_insumo, id_usuario, tipo_movimiento,
             cantidad, referencia, id_referencia
           )
           VALUES ($1, $2, $3, 'ANULACION', $4, 'VENTA', $5)`,
          [
            venta.id_sucursal,
            idInsumo,
            idUsuario ? Number(idUsuario) : null,
            cantidadDevuelta,
            idVenta
          ]
        );
      }

      const updateRes = await client.query(
        `UPDATE venta
         SET estado = 'ANULADA'
         WHERE id_venta = $1
         RETURNING *`,
        [idVenta]
      );

      return updateRes.rows[0];
    });

    res.json({ ok: true, data: ventaAnulada });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ ok: false, mensaje: err.message });
    }
    next(err);
  }
}