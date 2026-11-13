// Servicio central para consumir la API. Todas las pantallas deben pasar por aquí.
// Uso:  import { api } from './services/api';
//       const productos = await api.get('/productos');
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function peticion(ruta, opciones = {}) {
  const token = localStorage.getItem('token');
  const respuesta = await fetch(`${BASE_URL}${ruta}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...opciones
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(datos.mensaje || `Error ${respuesta.status}`);
  }
  return datos;
}

export const api = {
  get: (ruta) => peticion(ruta),
  post: (ruta, cuerpo) => peticion(ruta, { method: 'POST', body: JSON.stringify(cuerpo) }),
  put: (ruta, cuerpo) => peticion(ruta, { method: 'PUT', body: JSON.stringify(cuerpo) }),
  patch: (ruta, cuerpo) => peticion(ruta, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  delete: (ruta) => peticion(ruta, { method: 'DELETE' })
};
