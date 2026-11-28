import { api } from './api';

export async function obtenerTurnoActual() {
  const respuesta = await api.get('/turnos/actual');
  const turno = respuesta?.turno ?? respuesta?.data?.turno ?? null;
  if (turno === null) return null;
  if (!Number.isInteger(Number(turno.id_turno)) || Number(turno.id_turno) <= 0) {
    throw new Error('La API devolvió un turno abierto sin un ID válido.');
  }
  return turno;
}

export async function listarCajasDisponibles() {
  const respuesta = await api.get('/turnos/cajas');
  return respuesta?.cajas ?? [];
}

export async function abrirTurno({ id_caja, monto_apertura }) {
  return api.post('/turnos/abrir', {
    id_caja: Number(id_caja),
    monto_apertura: Number(monto_apertura)
  });
}

export async function obtenerCuadreTurno(idTurno) {
  return api.get(`/turnos/${idTurno}/cuadre`);
}

export async function cerrarTurno(idTurno, conteos) {
  // conteos: [{ metodo_pago: 'EFECTIVO' | 'TARJETA' | 'BITCOIN' | 'CHIVO', monto_contado: number }]
  return api.post(`/turnos/${idTurno}/cerrar`, { conteos });
}

export async function listarHistorialTurnos({ id_sucursal } = {}) {
  const params = new URLSearchParams();
  if (id_sucursal) params.set('id_sucursal', String(id_sucursal));
  const query = params.toString();
  const respuesta = await api.get(`/turnos${query ? `?${query}` : ''}`);
  return respuesta?.turnos ?? [];
}