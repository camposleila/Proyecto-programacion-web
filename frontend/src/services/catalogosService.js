import { api } from './api';

const desempaquetar = (r) => (r && r.data !== undefined ? r.data : r);

export async function listarSucursales() {
  const lista = desempaquetar(await api.get('/sucursales')) || [];
  return lista.map((s) => ({
    id_sucursal: s.id_sucursal ?? s.id,
    nombre: s.nombre
  }));
}
