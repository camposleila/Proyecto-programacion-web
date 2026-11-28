import { Plus, Trash2 } from 'lucide-react';
import { etiquetaMetodo } from '../../utils/constantes';
import { moneda } from '../../utils/dinero';

export default function PanelPagos({ pagos, onAgregar, onEditar, onQuitar }) {
  return (
    <div className="space-y-2.5">
      {pagos.map((p) => (
        <div
          key={p.uid}
          onClick={() => onEditar(p)}
          className="group flex cursor-pointer items-center justify-between rounded-xl border border-oliva/30 bg-crema px-3 py-2.5 shadow-sm hover:border-marino"
          title="Clic para editar"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="w-fit rounded-full bg-celeste px-3 py-0.5 text-sm font-semibold">{etiquetaMetodo(p.metodo_pago)}</span>
            {p.referencia && <span className="truncate text-xs text-oliva" title={p.referencia}>{p.referencia}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold">{moneda(p.monto)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onQuitar(p.uid); }}
              aria-label={`Quitar pago ${etiquetaMetodo(p.metodo_pago)}`}
              className="text-oliva hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      <button onClick={onAgregar} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold hover:text-oliva">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-marino"><Plus size={14} /></span>
        Agregar método de pago
      </button>
    </div>
  );
}
