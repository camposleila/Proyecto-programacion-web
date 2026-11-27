import { api } from './api';

function desempaquetar(r) {
  let respuesta = r;
  while (
    respuesta &&
    typeof respuesta === 'object' &&
    respuesta.data &&
    typeof respuesta.data === 'object' &&
    !respuesta.documento &&
    !respuesta.tipo_documento
  ) {
    respuesta = respuesta.data;
  }
  return respuesta;
}

export function normalizarVenta(entrada, contexto = {}) {
  const venta = desempaquetar(entrada);
  if (!venta || typeof venta !== 'object') {
    throw new Error('La API no devolvió los datos de la venta.');
  }

  const itemsContexto = contexto.items || [];
  const itemsPorId = new Map(itemsContexto.map((item) => [Number(item.id_producto), item]));
  const detalleApi = venta.detalle ?? venta.detalles ?? [];
  const detalle = detalleApi.map((linea) => {
    const item = itemsPorId.get(Number(linea.id_producto));
    const cantidad = Number(linea.cantidad ?? item?.cantidad ?? 0);
    const precio = Number(linea.precio_unitario ?? item?.precio ?? 0);
    return {
      ...linea,
      nombre: linea.nombre ?? linea.producto_nombre ?? item?.nombre ?? `Producto ${linea.id_producto}`,
      cantidad,
      precio_unitario: precio,
      total_linea: Number(linea.total_linea ?? precio * cantidad)
    };
  });

  const clienteApi = venta.cliente || {};
  const clienteContexto = contexto.cliente || {};
  const documentoApi = venta.documento || {};
  const documento = {
    ...documentoApi,
    id_venta: documentoApi.id_venta ?? venta.id_venta,
    tipo_documento: documentoApi.tipo_documento ?? venta.tipo_documento ?? contexto.tipoDocumento,
    serie: documentoApi.serie ?? venta.serie,
    numero_documento: documentoApi.numero_documento ?? venta.numero_documento,
    fecha: documentoApi.fecha ?? venta.fecha,
    estado: documentoApi.estado ?? venta.estado,
    moneda: documentoApi.moneda ?? venta.moneda ?? 'USD'
  };
  const sumaLineas = detalle.reduce((suma, linea) => suma + linea.total_linea, 0);

  return {
    ...venta,
    documento,
    cliente: {
      ...clienteContexto,
      ...clienteApi,
      id_cliente: clienteApi.id_cliente ?? venta.id_cliente ?? clienteContexto.id_cliente ?? null,
      nombre: clienteApi.nombre ?? venta.cliente_nombre ?? clienteContexto.nombre ?? 'Consumidor final',
      email: clienteApi.email ?? venta.cliente_email ?? clienteContexto.email ?? null,
      dui: clienteApi.dui ?? venta.cliente_dui ?? clienteContexto.dui ?? null,
      nit: clienteApi.nit ?? venta.cliente_nit ?? clienteContexto.nit ?? null,
      nrc: clienteApi.nrc ?? venta.cliente_nrc ?? clienteContexto.nrc ?? null,
      giro: clienteApi.giro ?? venta.cliente_giro ?? clienteContexto.giro ?? null,
      direccion: clienteApi.direccion ?? venta.cliente_direccion ?? clienteContexto.direccion ?? null,
      es_contribuyente: clienteApi.es_contribuyente ?? venta.es_contribuyente ?? clienteContexto.es_contribuyente ?? false
    },
    detalle,
    atencion: {
      sucursal: venta.sucursal_nombre ?? contexto.sucursal ?? venta.atencion?.sucursal ?? '',
      empleado: contexto.empleado ?? venta.atencion?.empleado ?? ''
    },
    pagos: venta.pagos || [],
    totales: {
      suma_lineas: Number(venta.totales?.suma_lineas ?? sumaLineas),
      descuento: Number(venta.totales?.descuento ?? venta.descuento ?? 0),
      subtotal: Number(venta.totales?.subtotal ?? venta.subtotal ?? 0),
      iva: Number(venta.totales?.iva ?? venta.iva ?? 0),
      total: Number(venta.totales?.total ?? venta.total ?? 0)
    }
  };
}

// POST /api/ventas  → devuelve la factura (documento, cliente, detalle, atencion, pagos, totales)
export async function crearVenta(payload, contexto = {}) {
  const venta = desempaquetar(await api.post('/ventas', payload));
  return normalizarVenta(venta, { ...contexto, tipoDocumento: payload.tipo_documento });
}

// GET /api/ventas/:id  → misma forma que la respuesta del POST
export async function obtenerVenta(id) {
  return normalizarVenta(desempaquetar(await api.get(`/ventas/${id}`)));
}
