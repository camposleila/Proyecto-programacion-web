import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  obtenerTurnoActual,
  listarCajasDisponibles,
  abrirTurno,
  obtenerCuadreTurno,
  cerrarTurno,
  listarHistorialTurnos
} from '../../services/turnosService';
import { listarSucursales } from '../../services/catalogosService';
import { moneda, r2 } from '../../utils/dinero';
import { getUsuario } from '../../utils/sesion';

const ETIQUETAS_METODO = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  BITCOIN: 'Bitcoin',
  CHIVO: 'Chivo Wallet'
};

const ORDEN_METODOS = ['EFECTIVO', 'TARJETA', 'BITCOIN', 'CHIVO'];

// Formatea fecha/hora estilo "26/11/2026 7:00 a. m." en hora de El Salvador
function formatearFechaHoraSV(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d);
  const hora = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
  return `${fecha} ${hora}`;
}

// Formatea monto con signo negativo adelante ("-$ 0.20") igual que en el diseño
function monedaConSigno(valor) {
  const n = r2(valor);
  if (n < 0) return `-$ ${Math.abs(n).toFixed(2)}`;
  if (n > 0) return `$ ${n.toFixed(2)}`;
  return '$ 0.00';
}

export default function TabTurnoActual({
  onCambiarTitulo,
  onIrHistorial,
  onTurnoCerrado
}) {
  const usuario = getUsuario();
  const esAdmin = usuario.rol === 'Administrador';

  // ── ESTADOS DE TURNO Y CATÁLOGOS ─────────────────────────────
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [ultimoTurnoCaja, setUltimoTurnoCaja] = useState(null);
  const [detalleEsperado, setDetalleEsperado] = useState([]);
  const [cargando, setCargando] = useState(true);

  // ── ESTADOS PANTALLA 1: APERTURA DE TURNO ────────────────────
  const [idSucursal, setIdSucursal] = useState(
    usuario.id_sucursal ? String(usuario.id_sucursal) : ''
  );
  const [idCaja, setIdCaja] = useState('');
  const [montoApertura, setMontoApertura] = useState('50.00');
  const [notaApertura, setNotaApertura] = useState('');
  const [abriendo, setAbriendo] = useState(false);

  // ── ESTADOS PANTALLA 2: CIERRE DE CAJA ───────────────────────
  const [conteos, setConteos] = useState({
    EFECTIVO: '',
    TARJETA: '',
    BITCOIN: '',
    CHIVO: ''
  });
  const [observacionesCierre, setObservacionesCierre] = useState('');
  const [cerrando, setCerrando] = useState(false);

  // ── ALERTAS ──────────────────────────────────────────────────
  const [error, setError] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');

  // Carga inicial: verifica si hay turno abierto para decidir entre Pantalla 1 o Pantalla 2
  async function cargarEstado() {
    setCargando(true);
    setError('');
    try {
      const turno = await obtenerTurnoActual();
      setTurnoActivo(turno);

      if (turno) {
        // Hay turno abierto -> Pantalla 2: Cierre de caja
        if (onCambiarTitulo) onCambiarTitulo('Cierre de caja');
        const cuadre = await obtenerCuadreTurno(turno.id_turno);
        const filas = cuadre?.detalle ?? [];
        setDetalleEsperado(filas);

        // Pre-llenar inputs con los montos esperados como referencia inicial editable
        const inicialConteos = {};
        for (const f of filas) {
          inicialConteos[f.metodo_pago] = r2(f.monto_esperado).toFixed(2);
        }
        setConteos((prev) => ({ ...inicialConteos, ...prev }));
      } else {
        // No hay turno abierto -> Pantalla 1: Apertura de turno
        if (onCambiarTitulo) onCambiarTitulo('Apertura de turno');
        const [listaSuc, listaCajas, historial] = await Promise.all([
          listarSucursales(),
          listarCajasDisponibles(),
          listarHistorialTurnos()
        ]);
        setSucursales(listaSuc);
        setCajas(listaCajas);

        const sucInicial = idSucursal || (listaSuc[0] ? String(listaSuc[0].id_sucursal) : '');
        setIdSucursal(sucInicial);

        const cajasDeSuc = listaCajas.filter(
          (c) => !sucInicial || String(c.id_sucursal) === String(sucInicial)
        );
        const cajaInicial = cajasDeSuc[0] || listaCajas[0];
        if (cajaInicial) {
          setIdCaja(String(cajaInicial.id_caja));
          const ultimo = historial.find((t) => Number(t.id_caja) === Number(cajaInicial.id_caja));
          setUltimoTurnoCaja(ultimo || null);
        }
      }
    } catch (err) {
      setError(err.message || 'No se pudo consultar el estado de la caja.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarEstado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cajas filtradas según la sucursal elegida en Apertura de turno
  const cajasFiltradas = useMemo(() => {
    if (!idSucursal) return cajas;
    return cajas.filter((c) => String(c.id_sucursal) === String(idSucursal));
  }, [cajas, idSucursal]);

  const cajaSeleccionadaObj = useMemo(
    () => cajas.find((c) => String(c.id_caja) === String(idCaja)) || null,
    [cajas, idCaja]
  );

  // Al cambiar sucursal, selecciona automáticamente su primera caja
  function manejarCambioSucursal(nuevaSuc) {
    setIdSucursal(nuevaSuc);
    const primeras = cajas.filter((c) => String(c.id_sucursal) === String(nuevaSuc));
    if (primeras[0]) {
      setIdCaja(String(primeras[0].id_caja));
    } else {
      setIdCaja('');
    }
  }

  // ── ENVÍO APERTURA DE TURNO ──────────────────────────────────
  async function manejarAbrirTurno(e) {
    e.preventDefault();
    setError('');
    setMensajeOk('');

    if (!idCaja) return setError('Selecciona una caja para abrir el turno.');
    const monto = r2(montoApertura);
    if (Number.isNaN(monto) || monto < 0) {
      return setError('Ingresa un monto inicial válido mayor o igual a $0.00.');
    }

    setAbriendo(true);
    try {
      const resp = await abrirTurno({
        id_caja: Number(idCaja),
        monto_apertura: monto
      });
      if (resp?.turno?.id_turno && notaApertura.trim()) {
        localStorage.setItem(`turno_nota_${resp.turno.id_turno}`, notaApertura.trim());
      }
      setMensajeOk(resp?.mensaje || 'Turno abierto exitosamente.');
      setConteos({ EFECTIVO: '', TARJETA: '', BITCOIN: '', CHIVO: '' });
      await cargarEstado();
    } catch (err) {
      setError(err.message || 'No se pudo abrir el turno.');
    } finally {
      setAbriendo(false);
    }
  }

  // ── CÁLCULOS EN VIVO DE PANTALLA 2 (CIERRE DE CAJA) ──────────
  const filasArqueo = useMemo(() => {
    const mapa = new Map(
      detalleEsperado.map((d) => [d.metodo_pago, r2(d.monto_esperado)])
    );
    return ORDEN_METODOS.map((metodo) => {
      const esperado = mapa.get(metodo) ?? 0;
      const raw = conteos[metodo];
      const contado = raw === '' || raw === undefined ? 0 : r2(raw);
      const diferencia = r2(contado - esperado);
      return {
        metodo_pago: metodo,
        etiqueta: ETIQUETAS_METODO[metodo],
        monto_esperado: esperado,
        textoContado: raw ?? '',
        monto_contado: contado,
        diferencia
      };
    });
  }, [detalleEsperado, conteos]);

  const resumenCierre = useMemo(() => {
    const fondoInicial = r2(turnoActivo?.monto_apertura ?? 0);
    const totalEsperado = r2(filasArqueo.reduce((acc, f) => acc + f.monto_esperado, 0));
    const ventasTurno = r2(Math.max(0, totalEsperado - fondoInicial));
    const totalContado = r2(filasArqueo.reduce((acc, f) => acc + f.monto_contado, 0));
    const diferencia = r2(totalContado - totalEsperado);
    return { fondoInicial, ventasTurno, totalEsperado, totalContado, diferencia };
  }, [filasArqueo, turnoActivo]);

  // ── ENVÍO CIERRE DE TURNO ────────────────────────────────────
  async function manejarCerrarTurno(e) {
    e.preventDefault();
    if (!turnoActivo) return;
    setError('');
    setMensajeOk('');

    const payloadConteos = [];
    for (const f of filasArqueo) {
      if (f.textoContado === '' || Number.isNaN(Number(f.textoContado)) || Number(f.textoContado) < 0) {
        return setError(`Ingresa el monto contado para ${f.etiqueta}.`);
      }
      payloadConteos.push({
        metodo_pago: f.metodo_pago,
        monto_contado: f.monto_contado
      });
    }

    setCerrando(true);
    try {
      const resp = await cerrarTurno(turnoActivo.id_turno, payloadConteos);
      // Guardar observación local vinculada al turno para mostrarla en Historial de cierres
      if (observacionesCierre.trim()) {
        localStorage.setItem(
          `turno_obs_${turnoActivo.id_turno}`,
          observacionesCierre.trim()
        );
      }
      setMensajeOk(resp?.mensaje || `Turno #${turnoActivo.id_turno} cerrado correctamente.`);
      setObservacionesCierre('');
      setTurnoActivo(null);
      if (onTurnoCerrado) onTurnoCerrado();
      await cargarEstado();
    } catch (err) {
      setError(err.message || 'No se pudo cerrar el turno.');
    } finally {
      setCerrando(false);
    }
  }

  if (cargando) {
    return (
      <div className="rounded-2xl border border-marino/20 bg-white p-8 text-center text-sm text-marino/70">
        Consultando estado de caja...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rosa/40 px-4 py-3 text-sm font-medium text-marino">
          <AlertCircle size={18} className="shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      )}
      {mensajeOk && (
        <div className="flex items-center gap-2 rounded-xl bg-oliva/20 px-4 py-3 text-sm font-medium text-marino">
          <CheckCircle2 size={18} className="shrink-0 text-oliva" />
          <span>{mensajeOk}</span>
        </div>
      )}

      {/* =================================================================
          PANTALLA 1: APERTURA DE TURNO (2 COLUMNAS COMO EN FIGMA)
         ================================================================= */}
      {!turnoActivo ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Columna Izquierda: Datos del turno */}
          <form
            onSubmit={manejarAbrirTurno}
            className="rounded-2xl border border-marino/30 bg-crema/40 p-6 shadow-sm lg:col-span-7"
          >
            <h2 className="text-lg font-extrabold text-marino">Datos del turno</h2>
            <p className="mt-1 text-sm font-bold text-marino">
              Empleado: {usuario.codigo}
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-marino/80">
                  Selección de sucursal
                </label>
                <select
                  value={idSucursal}
                  onChange={(e) => manejarCambioSucursal(e.target.value)}
                  disabled={!esAdmin && Boolean(usuario.id_sucursal)}
                  className="w-full rounded-xl bg-marino px-4 py-3 text-sm font-bold text-crema focus:outline-none disabled:opacity-80"
                >
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-marino/80">
                  Caja
                </label>
                <select
                  value={idCaja}
                  onChange={(e) => setIdCaja(e.target.value)}
                  className="w-full rounded-xl bg-marino px-4 py-3 text-sm font-bold text-crema focus:outline-none"
                  required
                >
                  {cajasFiltradas.length === 0 && (
                    <option value="">Sin cajas disponibles</option>
                  )}
                  {cajasFiltradas.map((c) => (
                    <option key={c.id_caja} value={c.id_caja}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-marino/80">
                    Fecha y hora de apertura
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatearFechaHoraSV(new Date())}
                    className="w-full rounded-xl border border-marino/20 bg-white/70 px-4 py-2.5 text-sm text-marino/85 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-marino/80">
                    Monto inicial en efectivo
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-marino">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={montoApertura}
                      onChange={(e) => setMontoApertura(e.target.value)}
                      className="w-full rounded-xl border border-marino/20 bg-white/70 py-2.5 pl-8 pr-4 text-sm font-semibold text-marino focus:border-marino focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-marino/80">
                  Nota (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Agrega una nota sobre el turno..."
                  value={notaApertura}
                  onChange={(e) => setNotaApertura(e.target.value)}
                  className="w-full rounded-xl border border-marino/20 bg-white/70 p-3 text-sm text-marino placeholder:italic placeholder:text-marino/40 focus:border-marino focus:outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={abriendo || !idCaja}
                  className="rounded-full bg-rosa px-8 py-2.5 text-sm font-bold text-marino shadow-sm transition hover:brightness-95 disabled:opacity-50"
                >
                  {abriendo ? 'Abriendo...' : 'Abrir turno'}
                </button>
              </div>
            </div>
          </form>

          {/* Columna Derecha: Estado de la caja */}
          <div className="rounded-2xl border border-marino/30 bg-crema/40 p-6 shadow-sm lg:col-span-5">
            <h2 className="text-lg font-extrabold text-marino">Estado de la caja</h2>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-medium text-marino">
                {cajaSeleccionadaObj?.nombre || 'Caja 1'}
              </span>
              <span className="rounded-full bg-emerald-500 px-3.5 py-0.5 text-xs font-bold text-white">
                Disponible
              </span>
            </div>

            <p className="mt-2 text-xs text-marino/60">
              Solo puede haber un turno abierto por caja.
            </p>

            <div className="mt-5 border-t border-marino/15 pt-4">
              <h3 className="text-sm font-extrabold text-marino">Último turno</h3>

              {ultimoTurnoCaja ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-marino/75">Cierre</dt>
                    <dd className="font-medium text-marino">
                      {formatearFechaHoraSV(ultimoTurnoCaja.fecha_cierre)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-marino/75">Efectivo final</dt>
                    <dd className="font-semibold text-marino">
                      {monedaConSigno(ultimoTurnoCaja.total_contado)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-marino/75">Diferencia</dt>
                    <dd className="font-semibold text-marino">
                      {monedaConSigno(ultimoTurnoCaja.diferencia_total)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-marino/60">
                  Sin cierres previos registrados para esta caja.
                </p>
              )}

              <button
                type="button"
                onClick={onIrHistorial}
                className="mt-4 inline-block text-xs font-bold text-marino underline hover:text-marino/75"
              >
                Ver historial de cierres
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================
            PANTALLA 2: CIERRE DE CAJA (2 COLUMNAS COMO EN FIGMA)
           ================================================================= */
        <form
          onSubmit={manejarCerrarTurno}
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          {/* Columna Izquierda: Conteo por método de pago */}
          <div className="rounded-2xl border border-marino/30 bg-crema/40 p-6 shadow-sm lg:col-span-8">
            <h2 className="text-lg font-extrabold text-marino">Conteo por método de pago</h2>
            <p className="mt-1 text-sm font-bold text-marino">
              Turno #{String(turnoActivo.id_turno).padStart(4, '0')} · {turnoActivo.nombre_caja} · Empleado:{' '}
              {usuario.codigo}
            </p>
            <p className="text-xs text-marino/65">
              Abierto el {formatearFechaHoraSV(turnoActivo.fecha_apertura)}
            </p>

            {/* Encabezados de columnas */}
            <div className="mt-5 grid grid-cols-12 px-4 text-xs font-bold text-marino">
              <div className="col-span-4">Método</div>
              <div className="col-span-3 text-right">Esperado</div>
              <div className="col-span-3 text-center">Contado</div>
              <div className="col-span-2 text-right">Diferencia</div>
            </div>

            {/* Tarjetas por cada método de pago */}
            <div className="mt-2 space-y-3">
              {filasArqueo.map((fila) => {
                const dif = fila.diferencia;
                return (
                  <div
                    key={fila.metodo_pago}
                    className="grid grid-cols-12 items-center rounded-xl border border-marino/30 bg-white/70 px-4 py-3"
                  >
                    <div className="col-span-4 text-sm font-medium text-marino">
                      {fila.etiqueta}
                    </div>

                    <div className="col-span-3 text-right text-sm font-medium text-marino">
                      {moneda(fila.monto_esperado)}
                    </div>

                    <div className="col-span-3 px-2">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-marino">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={fila.textoContado}
                          onChange={(e) =>
                            setConteos((prev) => ({
                              ...prev,
                              [fila.metodo_pago]: e.target.value
                            }))
                          }
                          className="w-full rounded-xl border border-marino/20 bg-crema/60 py-2 pl-7 pr-3 text-sm font-semibold text-marino focus:border-marino focus:outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div
                      className={`col-span-2 text-right text-sm font-bold ${
                        dif < 0 ? 'text-red-600' : 'text-marino'
                      }`}
                    >
                      {monedaConSigno(dif)}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 text-xs text-marino/65">
              El efectivo esperado incluye el fondo inicial de {monedaConSigno(resumenCierre.fondoInicial)}.
            </p>
          </div>

          {/* Columna Derecha: Resumen del cierre */}
          <div className="rounded-2xl border border-marino/30 bg-crema/40 p-6 shadow-sm lg:col-span-4">
            <h2 className="text-lg font-extrabold text-marino">Resumen del cierre</h2>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-marino/80">Fondo inicial</dt>
                <dd className="font-medium text-marino">
                  {monedaConSigno(resumenCierre.fondoInicial)}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-marino/80">Ventas del turno</dt>
                <dd className="font-medium text-marino">
                  {monedaConSigno(resumenCierre.ventasTurno)}
                </dd>
              </div>
            </dl>

            {/* Bloque destacado TOTAL en celeste */}
            <div className="my-4 flex items-center justify-between rounded-xl bg-celeste px-4 py-3">
              <span className="text-base font-extrabold text-marino">TOTAL</span>
              <span className="text-xl font-extrabold text-marino">
                {monedaConSigno(resumenCierre.totalEsperado)}
              </span>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-marino/80">Total contado</dt>
                <dd className="font-semibold text-marino">
                  {monedaConSigno(resumenCierre.totalContado)}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-marino/80">Diferencia</dt>
                <dd
                  className={`font-bold ${
                    resumenCierre.diferencia < 0 ? 'text-red-600' : 'text-marino'
                  }`}
                >
                  {monedaConSigno(resumenCierre.diferencia)}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-marino/80">
                Observaciones
              </label>
              <textarea
                rows={3}
                placeholder="Explica la diferencia, si existe..."
                value={observacionesCierre}
                onChange={(e) => setObservacionesCierre(e.target.value)}
                className="w-full rounded-xl border border-marino/20 bg-white/70 p-3 text-xs text-marino placeholder:italic placeholder:text-marino/40 focus:border-marino focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={cerrando}
              className="mt-6 w-full rounded-full bg-rosa py-3 text-sm font-bold text-marino shadow-sm transition hover:brightness-95 disabled:opacity-50"
            >
              {cerrando ? 'Cerrando turno...' : 'Cerrar turno'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}