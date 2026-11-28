import { api } from './api';
import { formatearIdCliente } from '../utils/formatos';

const desempaquetar = (r) => (r && r.data !== undefined ? r.data : r);

export async function listarClientes() {
  return desempaquetar(await api.get('/clientes')) || [];
}

// Filtra únicamente por nombre o por el ID interno CL-XXXX-XXXX-XXXX.
export function filtrarClientes(clientes, texto) {
  const q = String(texto || '').trim().toLocaleLowerCase('es');
  if (!q) return clientes.slice(0, 8);

  if (/^cl-/i.test(q)) {
    return clientes.filter((cliente) =>
      formatearIdCliente(cliente.id_cliente).toLocaleLowerCase('es').includes(q)
    ).slice(0, 8);
  }

  if (/^\d+$/.test(q)) {
    return clientes.filter((cliente) => String(cliente.id_cliente) === q).slice(0, 8);
  }

  return clientes.filter((cliente) =>
    String(cliente.nombre || '').toLocaleLowerCase('es').includes(q)
  ).slice(0, 8);
}

// POST /api/clientes  → devuelve el cliente creado (con id_cliente)
export async function crearCliente(cliente) {
  return desempaquetar(await api.post('/clientes', cliente));
}
