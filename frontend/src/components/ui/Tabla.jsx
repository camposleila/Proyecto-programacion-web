
export default function Tabla({
  columnas,
  datos = [],
  clave,
  mensajeVacio = 'No hay registros disponibles.',
  claseFila = () => ''
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-oliva/30">
      <table className="w-full text-left text-sm">
        <thead className="bg-marino text-crema">
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.campo}
                className="whitespace-nowrap px-4 py-3 font-semibold"
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {datos.length === 0 ? (
            <tr>
              <td
                colSpan={columnas.length}
                className="px-4 py-8 text-center text-oliva"
              >
                {mensajeVacio}
              </td>
            </tr>
          ) : (
            datos.map((fila, indice) => (
              <tr
                key={clave ? fila[clave] : indice}
                className={`border-b border-oliva/20 hover:bg-oliva/5 ${claseFila(fila)}`}
              >
                {columnas.map((columna) => (
                  <td
                    key={columna.campo}
                    className="px-4 py-3"
                  >
                    {columna.render
                      ? columna.render(fila)
                      : fila[columna.campo]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
