import { Construction } from 'lucide-react';

export default function ProximamentePage({ nombre, responsable }) {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Construction size={42} className="text-oliva" />
      <h1 className="text-2xl font-bold">{nombre}</h1>
      {responsable && <p className="text-sm text-oliva">Pantalla a cargo de {responsable}</p>}
    </div>
  );
}
