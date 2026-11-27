// Métodos de pago aceptados (pago mixto).
// "valor" es lo que se envía a la API en `metodo_pago`.
// ⚠ Si Backend 1 usa otros textos (p. ej. 'CHIVO_WALLET'), se cambia SOLO aquí.
export const METODOS_PAGO = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo', icono: 'Banknote', pideReferencia: false },
  { valor: 'TARJETA', etiqueta: 'Tarjeta', icono: 'CreditCard', pideReferencia: true },
  { valor: 'BITCOIN', etiqueta: 'Bitcoin', icono: 'Bitcoin', pideReferencia: true },
  { valor: 'CHIVO', etiqueta: 'Chivo Wallet', icono: 'Wallet', pideReferencia: true }
];

export const etiquetaMetodo = (valor) =>
  METODOS_PAGO.find((m) => m.valor === valor)?.etiqueta || valor;

export const TIPOS_DOCUMENTO = {
  FACTURA: { valor: 'FACTURA', etiqueta: 'Consumidor final', corto: 'FACTURA' },
  CCF: { valor: 'CCF', etiqueta: 'Crédito fiscal', corto: 'CCF' }
};

// Roles que pueden aplicar descuento (el backend responde 403 al resto)
export const ROLES_CON_DESCUENTO = ['Administrador', 'Gerente'];

// Visibilidad y navegación del frontend según la matriz de acceso del proyecto.
// La autorización efectiva de cada operación debe validarse también en el backend.
export const ROLES_POR_RUTA = {
  '/resumen': ['administrador', 'gerente'],
  '/ventas': ['administrador', 'gerente', 'cajero'],
  '/inventario': ['administrador', 'gerente', 'barista'],
  '/compras': ['administrador', 'gerente'],
  '/caja': ['administrador', 'gerente', 'cajero'],
  '/personal': ['administrador', 'gerente'],
  '/catalogo': ['administrador', 'gerente', 'cajero'],
  '/documento': ['administrador', 'gerente', 'cajero']
};

export function puedeAccederRuta(ruta, rol) {
  const clave = ruta.startsWith('/documento/') ? '/documento' : ruta;
  return ROLES_POR_RUTA[clave]?.includes(String(rol || '').trim().toLowerCase()) ?? false;
}

export function rutaInicialPorRol(rol) {
  const clave = String(rol || '').trim().toLowerCase();
  if (clave === 'barista') return '/inventario';
  if (['administrador', 'gerente', 'cajero'].includes(clave)) return '/catalogo';
  return '/login';
}
