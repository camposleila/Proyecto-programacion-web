import { useCallback, useEffect, useState } from 'react';
import { Bell, Menu, LogOut, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getUsuario } from '../../utils/sesion';
import { puedeAccederRuta } from '../../utils/constantes';
import { listarAlertasStock } from '../../services/inventarioService';

export default function Encabezado({ onMenu }) {
  const navegar = useNavigate();
  const usuario = getUsuario();
  const [alertasStock, setAlertasStock] = useState([]);
  const [alertasAbiertas, setAlertasAbiertas] = useState(false);
  const [estadoAlertas, setEstadoAlertas] = useState('cargando');
  const [errorAlertas, setErrorAlertas] = useState('');
  const puedeVerAlertasStock = puedeAccederRuta('/inventario', usuario.rol);

  const cargarAlertasStock = useCallback(async () => {
    setEstadoAlertas('cargando');
    setErrorAlertas('');
    try {
      setAlertasStock(await listarAlertasStock(usuario.id_sucursal));
      setEstadoAlertas('listo');
    } catch (error) {
      setErrorAlertas(error.message || 'No se pudieron cargar las alertas de stock.');
      setEstadoAlertas('error');
    }
  }, [usuario.id_sucursal]);

  useEffect(() => {
    if (puedeVerAlertasStock) cargarAlertasStock();
  }, [cargarAlertasStock, puedeVerAlertasStock]);

  const salir = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navegar('/login', { replace: true });
  };

  return (
    <header className="flex items-center justify-between border-b border-marino/80 px-6 py-5">
      <button onClick={onMenu} aria-label="Mostrar u ocultar menú" className="rounded-lg p-1 hover:bg-marino/10">
        <Menu size={26} />
      </button>
      <div className="flex items-center gap-5">
        {puedeVerAlertasStock && (
          <div className="relative">
            <button
              type="button"
              aria-label={`Alertas de stock${alertasStock.length ? `: ${alertasStock.length}` : ''}`}
              aria-expanded={alertasAbiertas}
              aria-controls="panel-alertas-stock"
              onClick={() => setAlertasAbiertas((abiertas) => !abiertas)}
              className="relative rounded-lg p-2 hover:bg-marino/10"
            >
              <Bell size={22} />
              {alertasStock.length > 0 && (
                <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-xs font-semibold leading-5 text-white">
                  {alertasStock.length > 99 ? '99+' : alertasStock.length}
                </span>
              )}
            </button>
            {alertasAbiertas && (
              <section
                id="panel-alertas-stock"
                aria-label="Alertas de stock"
                className="absolute right-0 z-50 mt-2 max-h-[min(70vh,32rem)] w-80 overflow-y-auto rounded-xl border border-marino/10 bg-white p-4 shadow-xl sm:w-96"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-marino">Alertas de stock</h2>
                    <p className="text-xs text-oliva">
                      {alertasStock.length
                        ? `${alertasStock.length} insumo${alertasStock.length === 1 ? '' : 's'} con stock bajo`
                        : 'Insumos que alcanzaron su stock mínimo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cargarAlertasStock}
                    disabled={estadoAlertas === 'cargando'}
                    aria-label="Actualizar alertas de stock"
                    className="rounded-lg p-2 text-marino hover:bg-marino/10 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={estadoAlertas === 'cargando' ? 'animate-spin' : ''} />
                  </button>
                </div>

                {estadoAlertas === 'cargando' && (
                  <p role="status" className="py-4 text-center text-sm text-oliva">Cargando alertas…</p>
                )}
                {estadoAlertas === 'error' && (
                  <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorAlertas}</p>
                )}
                {estadoAlertas === 'listo' && alertasStock.length === 0 && (
                  <p className="rounded-lg bg-oliva/10 p-3 text-sm text-marino">No hay insumos en nivel mínimo o por debajo.</p>
                )}
                {estadoAlertas === 'listo' && alertasStock.length > 0 && (
                  <ul className="space-y-2">
                    {alertasStock.map((alerta) => (
                      <li
                        key={`${alerta.id_sucursal}-${alerta.id_insumo}`}
                        className="rounded-lg border-l-4 border-amber-400 bg-crema p-3"
                      >
                        <p className="font-medium text-marino">{alerta.insumo}</p>
                        <p className="text-xs text-oliva">{alerta.sucursal}</p>
                        <p className="mt-1 text-xs text-marino">
                          Disponible: {formatearStock(alerta.stock_actual)} {alerta.abreviatura}
                          {' · '}Mínimo: {formatearStock(alerta.stock_minimo)} {alerta.abreviatura}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-xs leading-tight sm:block">
            <p className="font-semibold">{usuario.nombre}</p>
            <p className="text-oliva">{usuario.rol}</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-oliva/40" title={usuario.nombre} />
          <button onClick={salir} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-lg p-1 hover:bg-marino/10">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function formatearStock(valor) {
  return new Intl.NumberFormat('es-SV', { maximumFractionDigits: 3 }).format(Number(valor));
}
