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
