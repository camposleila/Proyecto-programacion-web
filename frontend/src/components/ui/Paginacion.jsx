
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Paginacion({
  pagina,
  totalRegistros,
  registrosPorPagina = 10,
  onCambiarPagina
}) {
  const totalPaginas = Math.max(
    1,
    Math.ceil(totalRegistros / registrosPorPagina)
  );

  const desde = totalRegistros === 0
    ? 0
    : (pagina - 1) * registrosPorPagina + 1;

  const hasta = Math.min(
    pagina * registrosPorPagina,
    totalRegistros
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-4">

      <p className="text-sm text-oliva">
        Mostrando {desde} - {hasta} de {totalRegistros} registros
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onCambiarPagina(pagina - 1)}
          disabled={pagina <= 1}
          className="btn-claro disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
        </button>

        <span className="px-3 text-sm font-semibold">
          {pagina} de {totalPaginas}
        </span>

        <button
          type="button"
          onClick={() => onCambiarPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          className="btn-claro disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

    </div>
  );
}
