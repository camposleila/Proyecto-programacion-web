// Lectura de la sesión guardada por la pantalla de login.
// api.js ya lee localStorage.token; aquí solo se LEE, nunca se escribe.
function decodificarJwt(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(payload))));
  } catch {
    return null;
  }
}

export const haySesion = () => Boolean(localStorage.getItem('token'));

// Devuelve { nombre, rol, codigo, id_empleado, id_sucursal } con lo que haya disponible
export function getUsuario() {
  const token = localStorage.getItem('token');
  let guardado = {};
  try {
    guardado = JSON.parse(localStorage.getItem('usuario') || '{}');
  } catch { /* ignorar */ }
  const jwt = token ? decodificarJwt(token) || {} : {};
  const u = { ...jwt, ...guardado };
  return {
    nombre: u.nombre_usuario || u.nombre || 'Usuario',
    rol: u.rol || u.nombre_rol || '',
    id_empleado: u.id_empleado ?? u.empleado_id ?? null,
    codigo: u.codigo_empleado || u.codigo || (u.id_empleado != null ? String(u.id_empleado) : '—'),
    id_sucursal: u.id_sucursal ?? null
  };
}
