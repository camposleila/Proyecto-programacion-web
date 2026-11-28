import { numeroDocumento } from '../../utils/formatos';

// Vista previa diminuta del documento (la que sale en el modal de éxito).
export default function MiniaturaFactura({ factura }) {
  const d = factura?.documento;
  return (
    <div className="mx-auto w-[92px] overflow-hidden rounded-sm border border-oliva/40 bg-crema shadow">
      <div className="bg-marino px-1.5 py-1.5">
        <p className="text-[6px] font-bold leading-none text-crema">Tarantines</p>
        <p className="mt-0.5 text-[4px] leading-none text-celeste">{d ? numeroDocumento(d.serie, d.numero_documento) : ''}</p>
      </div>
      <div className="space-y-[3px] p-1.5">
        {[70, 90, 55, 80, 65, 90, 40].map((w, i) => (
          <div key={i} className="h-[3px] rounded-full bg-oliva/20" style={{ width: `${w}%` }} />
        ))}
        <div className="ml-auto mt-1 h-3 w-1/2 rounded-sm bg-marino" />
      </div>
    </div>
  );
}
