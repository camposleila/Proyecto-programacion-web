// Cálculos de dinero. Misma lógica que el contrato de la API (docs/API_CONTRATOS.md):
//   suma_lineas = Σ(precio × cantidad)      (los precios YA incluyen IVA)
//   total       = suma_lineas − descuento
//   subtotal    = total / 1.13
//   iva         = total − subtotal
export const TASA_IVA = 0.13;

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const moneda = (n) => `$${r2(n || 0).toFixed(2)}`;

export function calcularTotales(items, descuento = 0) {
  const suma = r2(items.reduce((acc, i) => acc + i.precio * i.cantidad, 0));
  const desc = r2(Math.min(Math.max(Number(descuento) || 0, 0), suma));
  const total = r2(suma - desc);
  const subtotal = r2(total / (1 + TASA_IVA));
  const iva = r2(total - subtotal);
  return { suma_lineas: suma, descuento: desc, subtotal, iva, total };
}

// Convierte un porcentaje (0-100) a dólares sobre la suma de líneas
export const porcentajeADolares = (porcentaje, suma) =>
  r2((suma * Math.min(Math.max(Number(porcentaje) || 0, 0), 100)) / 100);
