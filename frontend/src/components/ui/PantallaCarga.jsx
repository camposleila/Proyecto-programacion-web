import { Loader2 } from 'lucide-react';

// Capa que bloquea la pantalla mientras el backend procesa el pago.
export default function PantallaCarga({ visible, texto = 'Procesando pago…' }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-marino/60 backdrop-blur-sm" role="alert" aria-busy="true">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-crema px-10 py-8 shadow-2xl">
        <Loader2 size={48} className="animate-spin text-marino" />
        <p className="text-lg font-semibold">{texto}</p>
        <p className="text-xs text-oliva">No cierres ni recargues la página</p>
      </div>
    </div>
  );
}
