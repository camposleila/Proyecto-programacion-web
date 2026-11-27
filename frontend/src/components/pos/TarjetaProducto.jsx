import { Plus, SquarePen, UtensilsCrossed } from 'lucide-react';
import { moneda } from '../../utils/dinero';

export default function TarjetaProducto({ producto, cantidad, onAgregar, onEditar }) {
  return (
    <div
      className={`relative cursor-pointer overflow-hidden rounded-xl border bg-crema shadow-sm transition hover:shadow-md ${
        cantidad > 0 ? 'border-marino ring-1 ring-marino' : 'border-oliva/30'
      }`}
      onClick={() => onAgregar(producto)}
    >
      <div className="relative h-28 bg-oliva/10">
        {producto.imagen ? (
          <img src={producto.imagen} alt={producto.nombre} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-oliva">
            <UtensilsCrossed size={36} />
          </div>
        )}
        {cantidad > 0 && (
          <span className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rosa text-xs font-bold text-crema">
            {cantidad}
          </span>
        )}
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-crema/90 text-marino">
          <Plus size={14} />
        </span>
      </div>
      <div className="flex items-end justify-between px-2.5 py-1.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">{producto.nombre}</p>
          <p className="text-sm font-bold">{moneda(producto.precio)}</p>
        </div>
        {onEditar && (
          <button
            aria-label={`Editar ${producto.nombre}`}
            onClick={(e) => { e.stopPropagation(); onEditar(producto); }}
            className="rounded p-1 hover:bg-oliva/10"
          >
            <SquarePen size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
