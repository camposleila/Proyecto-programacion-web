export default function TarjetaIndicador({
  titulo,
  valor,
  descripcion,
  icono: Icono,
  color = 'text-marino'
}) {
  return (
    <div className="rounded-xl border border-oliva/30 p-5">

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-oliva">
          {titulo}
        </p>

        {Icono && (
          <div className={`rounded-xl bg-oliva/10 p-3 ${color}`}>
            <Icono size={22} />
          </div>
        )}
      </div>

      <p className={`mt-3 text-3xl font-bold ${color}`}>
        {valor}
      </p>

      {descripcion && (
        <p className="mt-2 text-xs text-oliva">
          {descripcion}
        </p>
      )}

    </div>
  );
}
