import { api } from './api';

// ── COMPRAS ──────────────────────────────────────────────────
export async function listarCompras({ pagina = 1, limite = 25, id_sucursal } = {}) {
  const params = new URLSearchParams({
    pagina: String(pagina),
    limite: String(limite)
  });
  if (id_sucursal) params.set('id_sucursal', String(id_sucursal));
  return api.get(`/compras?${params.toString()}`);
}

export async function obtenerDetalleCompra(idCompra) {
  return api.get(`/compras/${idCompra}`);
}

export async function registrarCompra(payload) {
  // payload: { id_proveedor, id_sucursal, numero_documento, fecha_compra, condicion_pago, fecha_vencimiento, iva, detalles }
  return api.post('/compras', payload);
}

// ── CUENTAS POR PAGAR ────────────────────────────────────────
export async function listarCuentasPorPagar(estado = '') {
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';
  const respuesta = await api.get(`/cuentasporpagar${query}`);
  return respuesta?.cuentas ?? [];
}

export async function registrarPagoProveedor(idCuenta, { monto, metodo_pago }) {
  return api.post(`/cuentasporpagar/${idCuenta}/pagos`, {
    monto: Number(monto),
    metodo_pago: String(metodo_pago).trim().toUpperCase()
  });
}

// ── PROVEEDORES ──────────────────────────────────────────────
export async function listarProveedores({ todos = false, buscar = '' } = {}) {
  const params = new URLSearchParams();
  if (todos) params.set('todos', 'true');
  if (buscar.trim()) params.set('buscar', buscar.trim());
  const query = params.toString();
  const respuesta = await api.get(`/proveedores${query ? `?${query}` : ''}`);
  return respuesta?.proveedores ?? [];
}

export async function obtenerProveedor(idProveedor) {
  const respuesta = await api.get(`/proveedores/${idProveedor}`);
  return respuesta?.proveedor ?? null;
}

export async function crearProveedor({ nombre, nit, nrc, telefono, correo }) {
  return api.post('/proveedores', {
    nombre,
    nit: nit || null,
    nrc: nrc || null,
    telefono: telefono || null,
    correo: correo || null
  });
}

export async function actualizarProveedor(idProveedor, { nombre, nit, nrc, telefono, correo, activo }) {
  return api.put(`/proveedores/${idProveedor}`, {
    nombre,
    nit: nit || null,
    nrc: nrc || null,
    telefono: telefono || null,
    correo: correo || null,
    ...(typeof activo === 'boolean' ? { activo } : {})
  });
}

export async function desactivarProveedor(idProveedor) {
  return api.delete(`/proveedores/${idProveedor}`);
}

// ── CATÁLOGOS AUXILIARES ─────────────────────────────────────
export async function listarInsumosActivos() {
  const resp = await api.get('/insumos');
  return resp?.insumos ?? resp?.data ?? resp ?? [];
}