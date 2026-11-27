import { Minus, Plus, Trash2 } from 'lucide-react';
import { moneda } from '../../utils/dinero';

export default function LineaCarrito({ item, onCambiar, onQuitar }) {
  return (
    <div className="rounded-xl border border-oliva/30 bg-crema px-3 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-tight">{item.nombre}</p>
        <button onClick={() => onQuitar(item.id_producto)} aria-label={`Quitar ${item.nombre}`} className="text-marino hover:text-red-600">
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-sm font-bold">{moneda(item.precio)}</span>
        <div className="flex items-center gap-3 rounded-full bg-celeste px-2.5 py-0.5 text-sm font-semibold">
          <button onClick={() => onCambiar(item.id_producto, item.cantidad - 1)} aria-label="Restar uno"><Minus size={14} /></button>
          <span className="min-w-[1ch] text-center">{item.cantidad}</span>
          <button onClick={() => onCambiar(item.id_producto, item.cantidad + 1)} aria-label="Sumar uno"><Plus size={14} /></button>
        </div>
      </div>
    </div>
  );
}
