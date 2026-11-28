export default function GraficoVentas({ datos = [] }) {

  const maximo = Math.max(
    1,
    ...datos.map(item => item.total)
  );

  const formatoMoneda = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  });

  const sinVentas = datos.every(item => item.total === 0);

  return (
    <section className="rounded-xl border border-oliva/30 p-5">

      <h2 className="text-lg font-bold">
        Ventas de los últimos 7 días
      </h2>

      <p className="mt-1 text-sm text-oliva">
        Ingresos diarios por ventas emitidas.
      </p>

      {sinVentas && (
        <p className="mt-4 text-center text-sm text-oliva">
          No hay ventas registradas durante este período.
        </p>
      )}

      <div className="mt-6 flex gap-3">

        {/* Escala vertical */}
        <div className="flex h-56 flex-col justify-between text-xs text-oliva">
          {[1, 0.75, 0.5, 0.25, 0].map(valor => (
            <span key={valor}>
              {formatoMoneda.format(maximo * valor)}
            </span>
          ))}
        </div>

        <div className="relative flex-1">

          {/* Líneas horizontales */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-56 flex-col justify-between">
            {[1, 2, 3, 4, 5].map(linea => (
              <div
                key={linea}
                className="border-t border-dashed border-oliva/20"
              />
            ))}
          </div>

          {/* Barras del gráfico */}
          <div className="relative grid grid-cols-7 gap-2 sm:gap-4">

            {datos.map((item, indice) => (
              <div
                key={item.fecha}
                className="flex min-w-0 flex-col items-center"
              >
                <div className="flex h-56 w-full items-end justify-center">

                  <div
                    className={`relative w-3/4 max-w-16 rounded-t-md transition-all duration-300 ${
                      indice === datos.length - 1
                        ? 'bg-celeste'
                        : 'bg-marino'
                    }`}
                    style={{
                      height: `${(item.total / maximo) * 100}%`
                    }}
                    title={`${item.fecha}: ${formatoMoneda.format(item.total)}`}
                    aria-label={`${item.fecha}: ${formatoMoneda.format(item.total)}`}
                  />

                </div>

                <span className="mt-2 text-center text-xs text-oliva">
                  {item.etiqueta}
                </span>

                <span className="mt-1 text-center text-xs font-semibold">
                  {formatoMoneda.format(item.total)}
                </span>

              </div>
            ))}

          </div>

        </div>

      </div>

    </section>
  );
}
