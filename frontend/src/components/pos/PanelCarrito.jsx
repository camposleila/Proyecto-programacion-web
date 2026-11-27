import { useCarrito } from '../../context/CarritoContext';
import LineaCarrito from './LineaCarrito.jsx';
import BloqueTotales from './BloqueTotales.jsx';

// Panel reutilizado en /catalogo (con botón Cobrar) y en /checkout (resumen de orden).
export default function PanelCarrito({ titulo = 'Carrito', onCobrar, totales, porcentajeDescuento, className = '' }) {
  const { items, nota, setNota, cambiarCantidad, quitar, totales: totalesCarrito } = useCarrito();
  const t = totales || totalesCarrito;

  return (
    <section className={`flex flex-col rounded-2xl border border-marino bg-crema ${className}`}>
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="mb-3 text-2xl font-bold">{titulo}</h2>
        <div className="space-y-2">
          {items.length === 0 && <p className="py-6 text-center text-sm text-oliva">Aún no hay productos en el pedido</p>}
          {items.map((i) => (
            <LineaCarrito key={i.id_producto} item={i} onCambiar={cambiarCantidad} onQuitar={quitar} />
          ))}
        </div>

        <label htmlFor="nota-cocina" className="mb-1 mt-5 block px-1 text-sm">Nota para cocina (opcional)</label>
        <textarea
          id="nota-cocina"
          rows={4}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Agrega una nota (alergias, preferencias, etc...)"
          className="campo resize-none"
        />

        {onCobrar && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={onCobrar}
              disabled={items.length === 0}
              className="rounded-full bg-rosa px-5 py-1.5 text-sm font-bold text-marino transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cobrar
            </button>
          </div>
        )}
      </div>
      <BloqueTotales totales={t} porcentajeDescuento={porcentajeDescuento} />
    </section>
  );
}
