
import { Plus, Trash2 } from 'lucide-react';

export default function EditorReceta({
  receta,
  insumos,
  tipoProducto,
  onChange
}) {
  const esReventa = tipoProducto === 'REVENTA';

  function agregarInsumo() {
    onChange([
      ...receta,
      {
        id_insumo: '',
        cantidad: esReventa ? 1 : ''
      }
    ]);
  }

  function modificarInsumo(indice, campo, valor) {
    onChange(
      receta.map((item, i) =>
        i === indice
          ? { ...item, [campo]: valor }
          : item
      )
    );
  }

  function quitarInsumo(indice) {
    onChange(receta.filter((_, i) => i !== indice));
  }

  return (
    <div className="space-y-3">

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">
          Receta del producto
        </h3>

        <button
          type="button"
          className="btn-claro flex items-center gap-2"
          onClick={agregarInsumo}
          disabled={esReventa && receta.length >= 1}
        >
          <Plus size={16} />
          Agregar insumo
        </button>
      </div>

      <p className="text-sm text-oliva">
        {esReventa
          ? 'Seleccioná una unidad del producto empacado.'
          : 'Indicá los insumos necesarios para elaborar una unidad.'}
      </p>

      {receta.length === 0 && (
        <p className="rounded-lg border border-dashed border-oliva/30 p-4 text-center text-sm text-oliva">
          No hay insumos en la receta.
        </p>
      )}

      {receta.map((item, indice) => {
        const insumo = insumos.find(
          i => Number(i.id_insumo) === Number(item.id_insumo)
        );

        return (
          <div
            key={indice}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-oliva/30 p-3"
          >
            <div className="min-w-[180px] flex-1">
              <label
                htmlFor={`insumo-${indice}`}
                className="etiqueta"
              >
                Insumo
              </label>

              <select
                id={`insumo-${indice}`}
                className="campo"
                value={item.id_insumo}
                required
                onChange={e =>
                  modificarInsumo(
                    indice,
                    'id_insumo',
                    e.target.value
                  )
                }
              >
                <option value="">
                  Seleccionar insumo
                </option>

                {insumos.map(i => (
                  <option
                    key={i.id_insumo}
                    value={i.id_insumo}
                    disabled={receta.some(
                      (r, j) =>
                        j !== indice &&
                        Number(r.id_insumo) === Number(i.id_insumo)
                    )}
                  >
                    {i.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-28">
              <label
                htmlFor={`cantidad-${indice}`}
                className="etiqueta"
              >
                Cantidad
              </label>

              <input
                id={`cantidad-${indice}`}
                type="number"
                min="0.001"
                step="0.001"
                className="campo"
                value={item.cantidad}
                required
                disabled={esReventa}
                onChange={e =>
                  modificarInsumo(
                    indice,
                    'cantidad',
                    e.target.value
                  )
                }
              />
            </div>

            <div className="w-12 pb-3 text-sm text-oliva">
              {insumo?.abreviatura || '—'}
            </div>

            <button
              type="button"
              title="Quitar insumo"
              aria-label="Quitar insumo"
              className="rounded-lg p-3 text-red-600 hover:bg-red-100"
              onClick={() => quitarInsumo(indice)}
            >
              <Trash2 size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
