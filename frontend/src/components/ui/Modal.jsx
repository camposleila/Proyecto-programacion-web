import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ abierto, onCerrar, titulo, children, ancho = 'max-w-md', ocultarCerrar = false }) {
  useEffect(() => {
    if (!abierto) return undefined;
    const alTecla = (e) => e.key === 'Escape' && !ocultarCerrar && onCerrar?.();
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [abierto, onCerrar, ocultarCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-marino/50 p-4" onMouseDown={() => !ocultarCerrar && onCerrar?.()}>
      <div
        role="dialog"
        aria-modal="true"
        className={`relative max-h-[92vh] w-full ${ancho} overflow-y-auto rounded-2xl bg-crema p-6 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!ocultarCerrar && (
          <button onClick={onCerrar} aria-label="Cerrar" className="absolute left-4 top-4 rounded-lg p-1 hover:bg-marino/10">
            <X size={20} />
          </button>
        )}
        {titulo && <h2 className="mb-4 text-center text-xl font-bold">{titulo}</h2>}
        {children}
      </div>
    </div>
  );
}
