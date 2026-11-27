import { r2 } from './dinero';

const digitos = (v = '') => String(v).replace(/\D/g, '');

// ─────────────── TARJETA ───────────────
export const MARCAS = {
  VISA: { nombre: 'Visa', largos: [13, 16, 19] },
  MASTERCARD: { nombre: 'Mastercard', largos: [16] },
  AMEX: { nombre: 'American Express', largos: [15] },
  DISCOVER: { nombre: 'Discover', largos: [16, 17, 18, 19] }
};

export function detectarMarca(numero) {
  const d = digitos(numero);
  if (/^4/.test(d)) return 'VISA';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^(6011|65|64[4-9])/.test(d)) return 'DISCOVER';
  return null;
}

// Algoritmo de Luhn (dígito verificador de toda tarjeta real)
export function luhn(numero) {
  const d = digitos(numero);
  if (d.length < 12) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i += 1) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    suma += n;
  }
  return suma % 10 === 0;
}

// 4242 4242 4242 4242  (Amex: 3782 822463 10005)
export function formatearTarjeta(v) {
  const marca = detectarMarca(v);
  const d = digitos(v).slice(0, marca === 'AMEX' ? 15 : 19);
  if (marca === 'AMEX') return [d.slice(0, 4), d.slice(4, 10), d.slice(10)].filter(Boolean).join(' ');
  return d.replace(/(.{4})/g, '$1 ').trim();
}

export function formatearVencimiento(v) {
  const d = digitos(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

export function vencimientoValido(texto, ahora = new Date()) {
  const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(texto);
  if (!m) return 'Usa el formato MM/AA';
  const anio = 2000 + Number(m[2]);
  const finDeMes = new Date(anio, Number(m[1]), 0, 23, 59, 59);
  if (finDeMes < ahora) return 'La tarjeta está vencida';
  if (anio > ahora.getFullYear() + 20) return 'Fecha de vencimiento no válida';
  return null;
}

const REGEX_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'.\- ]+$/;
export function nombreValido(texto) {
  const t = texto.trim().replace(/\s+/g, ' ');
  if (!REGEX_NOMBRE.test(t) || t.length < 5 || t.split(' ').length < 2) return false;
  return true;
}

export function validarTarjeta(d, ahora = new Date()) {
  const e = {};
  const marca = detectarMarca(d.numero);
  const n = digitos(d.numero);
  if (!n) e.numero = 'Ingresa el número de tarjeta';
  else if (!marca) e.numero = 'Solo se aceptan Visa, Mastercard, American Express o Discover';
  else if (!MARCAS[marca].largos.includes(n.length)) e.numero = `Una ${MARCAS[marca].nombre} lleva ${MARCAS[marca].largos.join(' o ')} dígitos`;
  else if (!luhn(n)) e.numero = 'Número de tarjeta no válido (revisa los dígitos)';

  if (!d.titular.trim()) e.titular = 'Ingresa el nombre del titular';
  else if (!nombreValido(d.titular)) e.titular = 'Escribe nombre y apellido, solo letras';

  const errExp = vencimientoValido(d.exp, ahora);
  if (!d.exp) e.exp = 'Ingresa la fecha de vencimiento';
  else if (errExp) e.exp = errExp;

  if (!/^[A-Za-z0-9-]{4,20}$/.test(d.autorizacion.trim())) e.autorizacion = 'Código de autorización / voucher de 4 a 20 caracteres';
  return { errores: e, marca, ultimos4: n.slice(-4) };
}

// ─────────────── BITCOIN ───────────────
export function validarBitcoin(d) {
  const e = {};
  const id = d.txid.trim();
  const hex64 = /^[a-fA-F0-9]{64}$/.test(id);
  if (!id) e.txid = d.red === 'LIGHTNING' ? 'Ingresa el hash del pago o la factura Lightning' : 'Ingresa el ID de la transacción (TXID)';
  else if (d.red === 'LIGHTNING' ? !(hex64 || /^ln(bc|tb)[0-9a-z]{20,}$/i.test(id)) : !hex64) {
    e.txid = d.red === 'LIGHTNING' ? 'Hash de 64 caracteres hex o factura que empiece con lnbc' : 'El TXID debe tener 64 caracteres hexadecimales (0-9, a-f)';
  }

  const btc = Number(d.montoBtc);
  if (!d.montoBtc) e.montoBtc = 'Ingresa el monto recibido en BTC';
  else if (!(btc > 0) || btc > 21) e.montoBtc = 'Monto en BTC no válido';
  else if (!/^\d+(\.\d{1,8})?$/.test(String(d.montoBtc))) e.montoBtc = 'Máximo 8 decimales';

  if (!d.confirmado) e.confirmado = 'Confirma que el pago ya fue recibido';
  return { errores: e };
}

// ─────────────── CHIVO WALLET ───────────────
export function formatearTelefono(v) {
  const d = digitos(v).slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d;
}

export function validarChivo(d) {
  const e = {};
  if (!/^[67]\d{7}$/.test(digitos(d.telefono))) e.telefono = 'Celular de 8 dígitos que empiece con 6 o 7';
  if (!d.titularChivo.trim()) e.titularChivo = 'Ingresa el nombre del titular de la cuenta';
  else if (!nombreValido(d.titularChivo)) e.titularChivo = 'Escribe nombre y apellido, solo letras';
  if (!/^[A-Za-z0-9-]{6,36}$/.test(d.idTransaccion.trim())) e.idTransaccion = 'ID de transacción de 6 a 36 caracteres (letras, números o guion)';
  if (!d.confirmado) e.confirmado = 'Confirma que el pago ya fue recibido';
  return { errores: e };
}

// ─────────────── EFECTIVO ───────────────
// Solo en efectivo se puede recibir MÁS de lo que se cobra; la diferencia es el vuelto.
// recibido vacío = pago exacto.
export function calcularEfectivo(monto, recibidoTexto) {
  const aplicado = r2(monto);
  const vacio = recibidoTexto === '' || recibidoTexto == null;
  const recibido = vacio ? aplicado : r2(recibidoTexto);
  const vuelto = recibido > aplicado ? r2(recibido - aplicado) : 0;
  const faltante = recibido < aplicado ? r2(aplicado - recibido) : 0;
  return { aplicado, recibido, vuelto, faltante };
}
