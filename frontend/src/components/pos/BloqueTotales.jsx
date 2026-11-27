import { moneda } from '../../utils/dinero';

// Pie del carrito: Subtotal / IVA / TOTAL (y descuento si existe).
export default function BloqueTotales({ totales, porcentajeDescuento = 0 }) {
  return (
    <div className="border-t border-marino text-sm font-semibold">
      <div className="space-y-0.5 px-3 pt-2">
        {totales.descuento > 0 && (
          <>
            <Fila etiqueta="Productos" valor={moneda(totales.suma_lineas)} />
            <Fila etiqueta={`Descuento${porcentajeDescuento ? ` (${porcentajeDescuento}%)` : ''}`} valor={`-${moneda(totales.descuento)}`} />
          </>
        )}
        <Fila etiqueta="Subtotal" valor={moneda(totales.subtotal)} />
        <Fila etiqueta="IVA (13% incl.)" valor={moneda(totales.iva)} />
      </div>
      <div className="m-1.5 mt-1 flex items-end justify-between rounded-md bg-celeste px-2.5 py-1">
        <span className="text-base">TOTAL</span>
        <span className="text-2xl font-bold">{moneda(totales.total)}</span>
      </div>
    </div>
  );
}

const Fila = ({ etiqueta, valor }) => (
  <div className="flex justify-between"><span>{etiqueta}</span><span>{valor}</span></div>
);
