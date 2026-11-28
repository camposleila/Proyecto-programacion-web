import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { listarHistorialTurnos, obtenerCuadreTurno } from '../../services/turnosService';
import { listarSucursales } from '../../services/catalogosService';
import { moneda, r2 } from '../../utils/dinero';
import { getUsuario } from '../../utils/sesion';

const ETIQUETAS_METODO = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BITCOIN: 'Bitcoin',
  CHIVO: 'Chivo Wallet'
};

function formatearFecha(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(iso));
}

function formatearHora(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(iso));
}

function badgeDiferencia(valor) {
  const dif = r2(valor);
  if (dif === 0) return '$ 0.00';
  if (dif > 0) return `+$ ${dif.toFixed(2)}`;
  return `-$ ${Math.abs(dif).toFixed(2)}`;
}

function monedaEspacio(valor) {
  const n = r2(valor);
  if (n < 0) return `-$ ${Math.abs(n).toFixed(2)}`;
  return `$ ${n.toFixed(2)}`;
}

export default function TabHistorialCierres({ recargarTrigger }) {
  const usuario = getUsuario();
  const esAdmin = usuario.rol === 'Administrador';

  // ── ESTADOS DE LISTA Y FILTROS ───────────────────────────────
  const [turnos, setTurnos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [idSucursal, setIdSucursal] = useState(
    usuario.id_sucursal ? String(usuario.id_sucursal) : ''
  );
  // 'TODOS' | 'CUADRADOS' | 'CON_DIFERENCIA'
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  // ── ESTADOS DEL PANEL DERECHO (DETALLE DEL TURNO SELECCIONADO)
  const [turnoSeleccionadoId, setTurnoSeleccionadoId] = useState(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  // Carga inicial de sucursales y cierres
  async function cargarHistorial() {
    setCargando(true);
    setError('');
    try {
      const [listaSuc, listaTurnos] = await Promise.all([
        listarSucursales(),
        listarHistorialTurnos({ id_sucursal: idSucursal || undefined })
      ]);
      setSucursales(listaSuc);
      setTurnos(listaTurnos);

      // Seleccionar por defecto el primer turno de la lista para mostrar su detalle a la derecha
      if (listaTurnos.length > 0) {
        seleccionarTurno(listaTurnos[0]);
      } else {
        setTurnoSeleccionadoId(null);
        setDetalleSeleccionado(null);
      }
    } catch (err) {
      setError(err.message || 'No se pudo cargar el historial de cierres.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idSucursal, recargarTrigger]);

  // Carga el desglose por método de pago del turno clicado en el panel derecho
  async function seleccionarTurno(turnoResumen) {
    setTurnoSeleccionadoId(turnoResumen.id_turno);
    setCargandoDetalle(true);
    try {
      const data = await obtenerCuadreTurno(turnoResumen.id_turno);
      setDetalleSeleccionado({
        resumen: turnoResumen,
        turno: data?.turno ?? turnoResumen,
        detalle: data?.detalle ?? []
      });
    } catch (err) {
      setError(err.message || 'No se pudo consultar el detalle del turno.');
    } finally {
      setCargandoDetalle(false);
    }
  }

  // Filtra turnos por Todos / Cuadrados / Con diferencia
  const turnosFiltrados = useMemo(() => {
    return turnos.filter((t) => {
      const dif = r2(t.diferencia_total);
      if (filtroEstado === 'CUADRADOS') return dif === 0;
      if (filtroEstado === 'CON_DIFERENCIA') return dif !== 0;
      return true;
    });
  }, [turnos, filtroEstado]);

  // Observación almacenada para el turno activo en el panel derecho
  const observacionTurno = useMemo(() => {
    if (!turnoSeleccionadoId) return '';
    return (
      localStorage.getItem(`turno_obs_${turnoSeleccionadoId}`) ||
      localStorage.getItem(`turno_nota_${turnoSeleccionadoId}`) ||
      'Sin observaciones registradas en este cierre.'
    );
  }, [turnoSeleccionadoId]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rosa/40 px-4 py-3 text-sm font-medium text-marino">
          <AlertCircle size={18} className="shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      )}

      {/* =================================================================
          PANTALLA 3: HISTORIAL DE CIERRES (2 COLUMNAS COMO EN FIGMA)
         ================================================================= */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Filtros + Listado de turnos */}
        <div className="space-y-4 lg:col-span-8">
          {/* Barra de filtro por sucursal + píldoras Todos / Cuadrados / Con diferencia */}
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={idSucursal}
              onChange={(e) => setIdSucursal(e.target.value)}
              disabled={!esAdmin && Boolean(usuario.id_sucursal)}
              className="rounded-xl bg-marino px-4 py-2 text-xs font-bold text-crema focus:outline-none disabled:opacity-85"
            >
              {esAdmin && <option value="">Todas las sucursales</option>}
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>

            {[
              { id: 'TODOS', etiqueta: 'Todos' },
              { id: 'CUADRADOS', etiqueta: 'Cuadrados' },
              { id: 'CON_DIFERENCIA', etiqueta: 'Con diferencia' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltroEstado(f.id)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                  filtroEstado === f.id
                    ? 'bg-marino text-crema'
                    : 'border border-marino/30 bg-white text-marino hover:bg-marino/5'
                }`}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>

          {/* Encabezados de tabla */}
          <div className="grid grid-cols-12 px-4 text-xs font-bold text-marino">
            <div className="col-span-4">Turno / Fecha</div>
            <div className="col-span-3">Caja y cajero</div>
            <div className="col-span-2 text-right">Esperado</div>
            <div className="col-span-1 text-right">Contado</div>
            <div className="col-span-2 text-center">Diferencia</div>
          </div>

          {/* Filas estilo tarjeta redondeada */}
          {cargando ? (
            <div className="rounded-2xl border border-marino/20 bg-white p-8 text-center text-sm text-marino/70">
              Cargando historial de cierres...
            </div>
          ) : turnosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-marino/20 bg-white p-8 text-center text-sm text-marino/70">
              No hay cierres registrados para el filtro seleccionado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {turnosFiltrados.map((t) => {
                const dif = r2(t.diferencia_total);
                const seleccionado = Number(t.id_turno) === Number(turnoSeleccionadoId);

                return (
                  <button
                    key={t.id_turno}
                    type="button"
                    onClick={() => seleccionarTurno(t)}
                    className={`grid w-full grid-cols-12 items-center rounded-xl border px-4 py-3 text-left transition ${
                      seleccionado
                        ? 'border-marino bg-celeste/75 shadow-sm'
                        : 'border-marino/25 bg-white/75 hover:bg-celeste/25'
                    }`}
                  >
                    <div className="col-span-4">
                      <p className="text-sm font-extrabold text-marino">
                        Turno #{String(t.id_turno).padStart(4, '0')}
                      </p>
                      <p className="text-[11px] text-marino/70">
                        {formatearFecha(t.fecha_apertura)} · {formatearHora(t.fecha_apertura)} –{' '}
                        {formatearHora(t.fecha_cierre)}
                      </p>
                    </div>

                    <div className="col-span-3 text-xs text-marino/85">
                      {t.nombre_caja} · {t.nombre_usuario}
                    </div>

                    <div className="col-span-2 text-right text-sm font-medium text-marino">
                      {moneda(t.total_esperado)}
                    </div>

                    <div className="col-span-1 text-right text-sm font-medium text-marino">
                      {moneda(t.total_contado)}
                    </div>

                    <div className="col-span-2 flex justify-center">
                      <span
                        className={`inline-block min-w-[82px] rounded-full px-3 py-1 text-center text-xs font-bold text-white ${
                          dif === 0 ? 'bg-emerald-500' : 'bg-red-600'
                        }`}
                      >
                        {badgeDiferencia(dif)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Columna Derecha: Panel fijo Detalle del turno */}
        <div className="rounded-2xl border border-marino/30 bg-crema/40 p-6 shadow-sm lg:col-span-4">
          {!detalleSeleccionado ? (
            <p className="py-10 text-center text-xs text-marino/65">
              Selecciona un turno de la lista para auditar su cierre.
            </p>
          ) : cargandoDetalle ? (
            <p className="py-10 text-center text-xs text-marino/65">
              Cargando detalle del turno...
            </p>
          ) : (
            <div>
              <h2 className="text-lg font-extrabold text-marino">
                Detalle del turno #{String(detalleSeleccionado.turno.id_turno).padStart(4, '0')}
              </h2>
              <p className="mt-0.5 text-xs text-marino/65">
                {detalleSeleccionado.turno.nombre_caja} ·{' '}
                {detalleSeleccionado.resumen.nombre_usuario} ·{' '}
                {formatearFecha(detalleSeleccionado.turno.fecha_cierre)}
              </p>

              <div className="mt-4 flex justify-between text-sm">
                <span className="text-marino/80">Fondo inicial</span>
                <span className="font-semibold text-marino">
                  {monedaEspacio(detalleSeleccionado.turno.monto_apertura)}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-extrabold text-marino">Desglose por método</h3>

              <table className="mt-2 w-full text-xs">
                <thead>
                  <tr className="text-marino/75">
                    <th className="py-1 text-left font-semibold">Método</th>
                    <th className="py-1 text-right font-semibold">Esperado</th>
                    <th className="py-1 text-right font-semibold">Contado</th>
                    <th className="py-1 text-right font-semibold">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-marino/10">
                  {(detalleSeleccionado.detalle || []).map((d) => {
                    const dif = r2(d.diferencia);
                    return (
                      <tr key={d.metodo_pago}>
                        <td className="py-1.5 font-medium text-marino">
                          {ETIQUETAS_METODO[d.metodo_pago] || d.metodo_pago}
                        </td>
                        <td className="py-1.5 text-right text-marino/85">
                          {moneda(d.monto_esperado)}
                        </td>
                        <td className="py-1.5 text-right text-marino/85">
                          {moneda(d.monto_contado)}
                        </td>
                        <td
                          className={`py-1.5 text-right font-bold ${
                            dif < 0 ? 'text-red-600' : 'text-marino'
                          }`}
                        >
                          {monedaEspacio(dif)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex justify-between text-sm">
                <span className="text-marino/80">Total esperado</span>
                <span className="font-semibold text-marino">
                  {monedaEspacio(detalleSeleccionado.resumen.total_esperado)}
                </span>
              </div>

              {/* Bloque destacado CONTADO en celeste */}
              <div className="my-3 flex items-center justify-between rounded-xl bg-celeste px-4 py-3">
                <span className="text-base font-extrabold text-marino">CONTADO</span>
                <span className="text-xl font-extrabold text-marino">
                  {monedaEspacio(detalleSeleccionado.resumen.total_contado)}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-marino/80">Diferencia</span>
                <span
                  className={`font-bold ${
                    r2(detalleSeleccionado.resumen.diferencia_total) < 0
                      ? 'text-red-600'
                      : 'text-marino'
                  }`}
                >
                  {monedaEspacio(detalleSeleccionado.resumen.diferencia_total)}
                </span>
              </div>

              <div className="mt-4">
                <span className="mb-1.5 block text-xs font-medium text-marino/80">
                  Observaciones del cajero
                </span>
                <div className="rounded-xl border border-marino/20 bg-white/70 p-3 text-xs text-marino/85">
                  {observacionTurno}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}