import { api } from './api';

export async function listarAlertasStock(idSucursal) {
  const parametros = new URLSearchParams({ bajo_stock: 'true' });
  if (idSucursal !== null && idSucursal !== undefined) {
    parametros.set('id_sucursal', idSucursal);
  }

  const respuesta = await api.get(`/inventario?${parametros.toString()}`);
  const alertas = respuesta?.data ?? respuesta;
  if (!Array.isArray(alertas)) {
    throw new Error('La API devolvió un formato de alertas de stock no válido.');
  }
  return alertas;
}

// Consulta de existencias por sucursal

export async function listarExistencias(idSucursal = '') {
  const parametros = new URLSearchParams();

  if (idSucursal) {
    parametros.set('id_sucursal', idSucursal);
  }

  const respuesta = await api.get(
    `/inventario?${parametros.toString()}`
  );

  return respuesta.data ?? respuesta;
}

// Consulta del historial de movimientos

export async function listarMovimientos(
  idSucursal = '',
  tipoMovimiento = ''
) {
  const parametros = new URLSearchParams();

  if (idSucursal) {
    parametros.set('id_sucursal', idSucursal);
  }

  if (tipoMovimiento) {
    parametros.set('tipo_movimiento', tipoMovimiento);
  }

  const respuesta = await api.get(
    `/inventario/movimientos?${parametros.toString()}`
  );

  return respuesta.data ?? respuesta;
}