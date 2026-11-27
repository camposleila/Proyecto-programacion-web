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
