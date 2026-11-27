// Máscaras y validaciones de documentos salvadoreños
const soloDigitos = (v = '') => String(v).replace(/\D/g, '');

export function formatearIdCliente(id) {
  const numero = Number(id);
  if (!Number.isSafeInteger(numero) || numero < 1) return '';
  const digitos = String(numero).padStart(12, '0');
  return `CL-${digitos.match(/\d{4}/g).join('-')}`;
}

// DUI: 01234567-8
export function formatearDUI(v) {
  const d = soloDigitos(v).slice(0, 9);
  return d.length > 8 ? `${d.slice(0, 8)}-${d.slice(8)}` : d;
}
export const duiValido = (v) => soloDigitos(v).length === 9;

// NIT: 0614-150590-102-3
export function formatearNIT(v) {
  const d = soloDigitos(v).slice(0, 14);
  const partes = [d.slice(0, 4), d.slice(4, 10), d.slice(10, 13), d.slice(13, 14)];
  return partes.filter(Boolean).join('-');
}
export const nitValido = (v) => soloDigitos(v).length === 14;

// NRC: 123456-7
export function formatearNRC(v) {
  const d = soloDigitos(v).slice(0, 8);
  return d.length > 6 ? `${d.slice(0, d.length - 1)}-${d.slice(-1)}` : d;
}
export const nrcValido = (v) => {
  const n = soloDigitos(v).length;
  return n >= 6 && n <= 8;
};

export const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Fechas siempre en hora de El Salvador
export function fechaCorta(iso) {
  const f = iso ? new Date(iso) : new Date();
  const partes = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador', day: '2-digit', month: '2-digit', year: 'numeric'
  }).formatToParts(f);
  const g = (t) => partes.find((p) => p.type === t)?.value;
  return `${g('day')} / ${g('month')} / ${g('year')}`;
}

// A001 + 128  ->  A001-000128
export const numeroDocumento = (serie, numero) =>
  `${serie}-${String(numero).padStart(6, '0')}`;
