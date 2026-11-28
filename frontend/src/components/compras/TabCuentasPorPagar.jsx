import { useEffect, useState } from 'react';
import { DollarSign, CheckCircle2, AlertCircle, X, CreditCard } from 'lucide-react';
import { listarCuentasPorPagar, registrarPagoProveedor } from '../../services/comprasService';
import { moneda, r2 } from '../../utils/dinero';
import { fechaCorta } from '../../utils/formatos';

// Métodos válidos para liquidar facturas a proveedores (máx. 15 caracteres según esquema SQL)
const METODOS_PAGO_PROVEEDOR = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA'];

export default function TabCuentasPorPagar({ recargarTrigger }) {
  // ── ESTADOS DE LISTADO Y FILTRO ──────────────────────────────
  const [cuentas, setCuentas] = useState([]);
  // '' = muestra PENDIENTE y PARCIAL por defecto en el backend
  const [filtroEstado, setFiltroEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajeOk, setMensajeOk] = useState('');

  // ── ESTADOS DEL MODAL DE ABONO / PAGO ────────────────────────
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA');
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Consulta las cuentas por pagar filtradas por estado
  async function cargarCuentas(estado = filtroEstado) {
    setCargando(true);
    setError('');
    try {
      const lista = await listarCuentasPorPagar(estado);
      setCuentas(lista);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las cuentas por pagar.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarCuentas(filtroEstado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado, recargarTrigger]);

  // Abre el modal pre-llenando el saldo pendiente completo (el usuario puede bajarlo para abono parcial)
  function abrirModalPago(cuenta) {
    setCuentaSeleccionada(cuenta);
    setMontoAbono(String(r2(cuenta.saldo)));
    setMetodoPago('TRANSFERENCIA');
    setErrorModal('');
  }

  // Envía el abono al backend (POST /api/cuentasporpagar/:id/pagos)
  async function manejarRegistrarPago(e) {
    e.preventDefault();
    if (!cuentaSeleccionada) return;
    setErrorModal('');

    const monto = r2(montoAbono);
    const saldoActual = r2(cuentaSeleccionada.saldo);

    if (!monto || monto <= 0) {
      return setErrorModal('Ingresa un monto válido mayor a $0.00.');
    }
    if (monto > saldoActual) {
      return setErrorModal(`El abono (${moneda(monto)}) no puede superar el saldo pendiente (${moneda(saldoActual)}).`);
    }

    setProcesandoPago(true);
    try {
      const resp = await registrarPagoProveedor(cuentaSeleccionada.id_cuenta, {
        monto,
        metodo_pago: metodoPago
      });
      setMensajeOk(
        resp?.mensaje || `Abono de ${moneda(monto)} registrado a la factura ${cuentaSeleccionada.numero_documento}.`
      );
      setCuentaSeleccionada(null);
      await cargarCuentas(filtroEstado);
    } catch (err) {
      setErrorModal(err.message || 'No se pudo registrar el abono.');
    } finally {
      setProcesandoPago(false);
    }
  }

  // Cálculo rápido del saldo total pendiente visible en pantalla
  const totalPendienteVisible = r2(
    cuentas.reduce((acc, c) => acc + (c.estado !== 'PAGADA' ? Number(c.saldo) : 0), 0)
  );

  return (
    <div className="space-y-5">
      {/* ── BARRA SUPERIOR DE FILTROS Y RESUMEN ────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-marino/10">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { valor: '', etiqueta: 'Activas (Pendientes y Parciales)' },
            { valor: 'PENDIENTE', etiqueta: 'Solo Pendientes' },
            { valor: 'PARCIAL', etiqueta: 'Con Abono Parcial' },
            { valor: 'PAGADA', etiqueta: 'Pagadas' }
          ].map((btn) => (
            <button
              key={btn.valor}
              type="button"
              onClick={() => setFiltroEstado(btn.valor)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filtroEstado === btn.valor
                  ? 'bg-marino text-crema'
                  : 'bg-crema text-marino ring-1 ring-marino/15 hover:bg-celeste/40'
              }`}
            >
              {btn.etiqueta}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-crema px-4 py-2 text-right ring-1 ring-marino/10">
          <span className="block text-[11px] font-semibold uppercase text-marino/60">
            Saldo Pendiente Listado
          </span>
          <span className="text-lg font-extrabold text-marino">{moneda(totalPendienteVisible)}</span>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rosa/30 px-4 py-3 text-sm font-medium text-marino">
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

      {/* ── TABLA DE FACTURAS AL CRÉDITO ───────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-marino/10">
        {cargando ? (
          <p className="py-8 text-center text-sm text-marino/65">Consultando cuentas por pagar...</p>
        ) : cuentas.length === 0 ? (
          <p className="py-8 text-center text-sm text-marino/65">
            No hay cuentas por pagar registradas bajo este filtro.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-marino/15 text-xs uppercase text-marino/70">
                <tr>
                  <th className="px-3 py-2.5">Proveedor</th>
                  <th className="px-3 py-2.5">Factura / CCF</th>
                  <th className="px-3 py-2.5">Sucursal</th>
                  <th className="px-3 py-2.5">Vencimiento</th>
                  <th className="px-3 py-2.5 text-right">Monto Original</th>
                  <th className="px-3 py-2.5 text-right">Saldo Pendiente</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marino/10">
                {cuentas.map((c) => {
                  const estaPagada = c.estado === 'PAGADA' || Number(c.saldo) <= 0;
                  return (
                    <tr key={c.id_cuenta} className="hover:bg-crema/60">
                      <td className="px-3 py-3 font-semibold text-marino">{c.proveedor_nombre}</td>
                      <td className="px-3 py-3 text-marino/85">{c.numero_documento}</td>
                      <td className="px-3 py-3 text-marino/80">{c.sucursal_nombre}</td>
                      <td className="px-3 py-3 text-marino/85">{fechaCorta(c.fecha_vencimiento)}</td>
                      <td className="px-3 py-3 text-right text-marino/80">{moneda(c.monto_original)}</td>
                      <td className="px-3 py-3 text-right font-bold text-marino">{moneda(c.saldo)}</td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${
                            c.estado === 'PAGADA'
                              ? 'bg-oliva/25 text-marino'
                              : c.estado === 'PARCIAL'
                                ? 'bg-celeste/60 text-marino'
                                : 'bg-rosa/40 text-marino'
                          }`}
                        >
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {!estaPagada ? (
                          <button
                            type="button"
                            onClick={() => abrirModalPago(c)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-marino px-3.5 py-1.5 text-xs font-semibold text-crema transition hover:bg-marino/90"
                          >
                            <DollarSign size={14} />
                            Abonar
                          </button>
                        ) : (
                          <span className="text-xs font-medium text-marino/45">Saldada</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL PARA REGISTRAR ABONO A PROVEEDOR ─────────────── */}
      {cuentaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-marino/50 p-4">
          <form
            onSubmit={manejarRegistrarPago}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-marino/10 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-marino" />
                <h3 className="text-base font-bold text-marino">Registrar Abono a Proveedor</h3>
              </div>
              <button
                type="button"
                onClick={() => setCuentaSeleccionada(null)}
                className="rounded-full p-1 text-marino/60 hover:bg-marino/10 hover:text-marino"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-crema p-3.5 text-xs text-marino">
              <p>
                <span className="text-marino/65">Proveedor:</span>{' '}
                <strong>{cuentaSeleccionada.proveedor_nombre}</strong>
              </p>
              <p className="mt-1">
                <span className="text-marino/65">Documento:</span>{' '}
                <strong>{cuentaSeleccionada.numero_documento}</strong>
              </p>
              <p className="mt-1">
                <span className="text-marino/65">Saldo Pendiente Actual:</span>{' '}
                <strong className="text-sm text-marino">{moneda(cuentaSeleccionada.saldo)}</strong>
              </p>
            </div>

            {errorModal && (
              <div className="mb-3 rounded-xl bg-rosa/30 px-3 py-2 text-xs font-medium text-red-800">
                {errorModal}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  Monto a Abonar ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={r2(cuentaSeleccionada.saldo)}
                  value={montoAbono}
                  onChange={(e) => setMontoAbono(e.target.value)}
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm font-bold text-marino focus:border-marino focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  Método de Pago *
                </label>
                <select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                >
                  {METODOS_PAGO_PROVEEDOR.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCuentaSeleccionada(null)}
                className="rounded-full bg-crema px-4 py-2 text-xs font-semibold text-marino ring-1 ring-marino/20 hover:bg-marino/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={procesandoPago}
                className="rounded-full bg-marino px-5 py-2 text-xs font-semibold text-crema hover:bg-marino/90 disabled:opacity-50"
              >
                {procesandoPago ? 'Procesando...' : 'Confirmar Pago'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}