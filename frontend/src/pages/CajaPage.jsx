import { useState } from 'react';
import TabTurnoActual from '../components/caja/TabTurnoActual';
import TabHistorialCierres from '../components/caja/TabHistorialCierres';

export default function CajaPage() {
  // Pestaña activa: 'turno' (muestra Apertura o Cierre según estado) | 'historial'
  const [tabActiva, setTabActiva] = useState('turno');
  // Título dinámico centrado arriba igual que en el diseño de Figma
  const [tituloPantalla, setTituloPantalla] = useState('Apertura de turno');
  // Disparador para refrescar el historial al cerrar un turno
  const [recargarHistorial, setRecargarHistorial] = useState(0);

  function cambiarTab(nuevaTab) {
    setTabActiva(nuevaTab);
    if (nuevaTab === 'historial') {
      setTituloPantalla('Historial de cierres');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Título principal centrado idéntico a las 3 pantallas del prototipo */}
      <h1 className="text-center text-2xl font-extrabold text-marino">
        {tituloPantalla}
      </h1>

      {/* Navegación superior con botones tipo píldora */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => cambiarTab('turno')}
          className={`rounded-xl px-5 py-2 text-xs font-bold transition ${
            tabActiva === 'turno'
              ? 'bg-marino text-crema shadow-sm'
              : 'border border-marino/30 bg-white text-marino hover:bg-marino/5'
          }`}
        >
          Turno actual
        </button>

        <button
          type="button"
          onClick={() => cambiarTab('historial')}
          className={`rounded-xl px-5 py-2 text-xs font-bold transition ${
            tabActiva === 'historial'
              ? 'bg-marino text-crema shadow-sm'
              : 'border border-marino/30 bg-white text-marino hover:bg-marino/5'
          }`}
        >
          Historial de cierres
        </button>
      </div>

      {/* Renderizado de la pestaña seleccionada */}
      {tabActiva === 'turno' ? (
        <TabTurnoActual
          onCambiarTitulo={setTituloPantalla}
          onIrHistorial={() => cambiarTab('historial')}
          onTurnoCerrado={() => setRecargarHistorial((n) => n + 1)}
        />
      ) : (
        <TabHistorialCierres recargarTrigger={recargarHistorial} />
      )}
    </div>
  );
}