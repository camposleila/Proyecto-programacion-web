import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Eye, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import {
  listarCompras,
  obtenerDetalleCompra,
  registrarCompra,
  listarProveedores,
  listarInsumosActivos
} from '../../services/comprasService';
import { listarSucursales } from '../../services/catalogosService';
import { r2, moneda, TASA_IVA } from '../../utils/dinero';
import { fechaCorta } from '../../utils/formatos';
import { getUsuario } from '../../utils/sesion';

// Obtiene la fecha actual en formato YYYY-MM-DD según zona horaria de El Salvador
function hoyISO() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/El_Salvador',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const g = (t) => partes.find((p) => p.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export default function TabRegistrarCompra({ onCompraRegistrada }) {
  const usuario = getUsuario();
  const esAdmin = usuario.rol === 'Administrador';

  // ── ESTADOS DE CATÁLOGOS E HISTORIAL ─────────────────────────
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [comprasRecientes, setComprasRecientes] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  // ── ESTADOS DEL ENCABEZADO DE COMPRA (MAESTRO) ───────────────
  const [idProveedor, setIdProveedor] = useState('');
  const [idSucursal, setIdSucursal] = useState(usuario.id_sucursal ? String(usuario.id_sucursal) : '');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [fechaCompra, setFechaCompra] = useState(hoyISO());
  const [condicionPago, setCondicionPago] = useState('CONTADO');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [aplicaIva, setAplicaIva] = useState(true);

  // ── ESTADOS DE LÍNEAS DE INSUMOS (DETALLE) ───────────────────
  // Cada fila representa un insumo comprado con cantidad (hasta 3 decimales) y costo unitario
  const [detalles, setDetalles] = useState([
    { id_insumo: '', cantidad: '1', costo_unitario: '' }
  ]);

  // ── ESTADOS DE ENVÍO, ALERTAS Y MODAL DE DETALLE ─────────────
  const [guardando, setGuardando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState('');
  const [errorForm, setErrorForm] = useState('');
  const [detalleModal, setDetalleModal] = useState(null);
  const [cargandoModal, setCargandoModal] = useState(false);

  // Carga inicial paralela de proveedores activos, insumos activos, sucursales y últimas compras
  async function cargarTodo() {
    setCargandoDatos(true);
    try {
      const [listaProv, listaIns, listaSuc, respCompras] = await Promise.all([
        listarProveedores({ todos: false }),
        listarInsumosActivos(),
        listarSucursales(),
        listarCompras({ pagina: 1, limite: 15, id_sucursal: idSucursal || undefined })
      ]);
      setProveedores(listaProv);
      setInsumos(listaIns);
      setSucursales(listaSuc);
      setComprasRecientes(respCompras?.compras ?? []);

      // Si es Administrador y aún no tiene sucursal seleccionada, toma la primera disponible
      if (!idSucursal && listaSuc.length > 0) {
        setIdSucursal(String(listaSuc[0].id_sucursal));
      }
    } catch (err) {
      setErrorForm(err.message || 'No se pudieron cargar los catálogos iniciales');
    } finally {
      setCargandoDatos(false);
    }
  }

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CÁLCULOS FISCALES EN TIEMPO REAL ─────────────────────────
  // En compras a proveedores: subtotal = suma(cantidad * costo_unitario), IVA = 13% si aplica CCF
  const totales = useMemo(() => {
    const subtotal = r2(
      detalles.reduce((acc, fila) => {
        const cant = Number(fila.cantidad) || 0;
        const costo = Number(fila.costo_unitario) || 0;
        return acc + cant * costo;
      }, 0)
    );
    const iva = aplicaIva ? r2(subtotal * TASA_IVA) : 0;
    const total = r2(subtotal + iva);
    return { subtotal, iva, total };
  }, [detalles, aplicaIva]);

  // ── MANEJADORES DE FILAS DEL DETALLE ─────────────────────────
  function agregarFila() {
    setDetalles((prev) => [...prev, { id_insumo: '', cantidad: '1', costo_unitario: '' }]);
  }

  function eliminarFila(indice) {
    setDetalles((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== indice) : prev));
  }

  function actualizarFila(indice, campo, valor) {
    setDetalles((prev) =>
      prev.map((fila, i) => {
        if (i !== indice) return fila;
        const actualizada = { ...fila, [campo]: valor };
        // Si selecciona un insumo y el costo está vacío, sugiere su costo_promedio actual
        if (campo === 'id_insumo' && valor) {
          const insumoEncontrado = insumos.find((ins) => String(ins.id_insumo) === String(valor));
          if (insumoEncontrado && !fila.costo_unitario && Number(insumoEncontrado.costo_promedio) > 0) {
            actualizada.costo_unitario = String(Number(insumoEncontrado.costo_promedio));
          }
        }
        return actualizada;
      })
    );
  }

  // ── ENVÍO DEL FORMULARIO AL BACKEND (POST /api/compras) ──────
  async function manejarGuardarCompra(e) {
    e.preventDefault();
    setErrorForm('');
    setMensajeOk('');

    // Validaciones previas en cliente antes de disparar la transacción en PostgreSQL
    if (!idProveedor) return setErrorForm('Selecciona un proveedor activo.');
    if (!idSucursal) return setErrorForm('Selecciona la sucursal que recibe la compra.');
    if (!numeroDocumento.trim()) return setErrorForm('Ingresa el número de factura o CCF del proveedor.');
    if (!fechaCompra) return setErrorForm('Selecciona la fecha de compra.');
    if (condicionPago === 'CREDITO' && !fechaVencimiento) {
      return setErrorForm('Para compras al CRÉDITO debes indicar la fecha de vencimiento.');
    }
    if (condicionPago === 'CREDITO' && fechaVencimiento < fechaCompra) {
      return setErrorForm('La fecha de vencimiento no puede ser anterior a la fecha de compra.');
    }

    // Validar que no haya insumos vacíos o duplicados (el backend rechaza insumos repetidos en la misma compra)
    const idsUsados = new Set();
    const detallesLimpios = [];
    for (let i = 0; i < detalles.length; i += 1) {
      const fila = detalles[i];
      const idIns = Number(fila.id_insumo);
      const cant = Number(fila.cantidad);
      const costo = Number(fila.costo_unitario);

      if (!idIns || cant <= 0 || costo < 0 || Number.isNaN(cant) || Number.isNaN(costo)) {
        return setErrorForm(`Revisa la línea ${i + 1}: selecciona un insumo, cantidad mayor a 0 y costo válido.`);
      }
      if (idsUsados.has(idIns)) {
        return setErrorForm(`El insumo de la línea ${i + 1} está duplicado. Agrúpalo en una sola fila.`);
      }
      idsUsados.add(idIns);
      detallesLimpios.push({
        id_insumo: idIns,
        cantidad: cant,
        costo_unitario: costo
      });
    }

    setGuardando(true);
    try {
      const payload = {
        id_proveedor: Number(idProveedor),
        id_sucursal: Number(idSucursal),
        numero_documento: numeroDocumento.trim(),
        fecha_compra: fechaCompra,
        condicion_pago: condicionPago,
        ...(condicionPago === 'CREDITO' ? { fecha_vencimiento: fechaVencimiento } : {}),
        iva: totales.iva,
        detalles: detallesLimpios
      };

      const respuesta = await registrarCompra(payload);
      setMensajeOk(
        respuesta?.mensaje ||
          'Compra registrada exitosamente. El inventario y los costos promedio fueron actualizados.'
      );

      // Reiniciar formulario manteniendo proveedor/sucursal listos para la siguiente factura
      setNumeroDocumento('');
      setCondicionPago('CONTADO');
      setFechaVencimiento('');
      setDetalles([{ id_insumo: '', cantidad: '1', costo_unitario: '' }]);

      // Recargar historial reciente y notificar al padre por si se creó una cuenta por pagar
      const respCompras = await listarCompras({ pagina: 1, limite: 15, id_sucursal: idSucursal });
      setComprasRecientes(respCompras?.compras ?? []);
      if (onCompraRegistrada) onCompraRegistrada();
    } catch (err) {
      setErrorForm(err.message || 'Ocurrió un error al registrar la compra.');
    } finally {
      setGuardando(false);
    }
  }

  // Abre el modal con el detalle completo de una compra histórica (GET /api/compras/:id)
  async function verDetalle(idCompra) {
    setCargandoModal(true);
    setDetalleModal({ cargando: true });
    try {
      const data = await obtenerDetalleCompra(idCompra);
      setDetalleModal(data);
    } catch (err) {
      setDetalleModal(null);
      setErrorForm(err.message || 'No se pudo cargar el detalle de la compra.');
    } finally {
      setCargandoModal(false);
    }
  }

  if (cargandoDatos) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center text-sm text-marino/70 shadow-sm">
        Cargando catálogos de proveedores e insumos...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── FORMULARIO DE NUEVA COMPRA ─────────────────────────── */}
      <form onSubmit={manejarGuardarCompra} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-marino/10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-marino/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-marino">Ingreso de Factura / CCF de Compra</h2>
            <p className="text-xs text-marino/65">
              Al guardar se incrementa automáticamente el inventario de la sucursal y se recalcula el costo promedio.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-full bg-crema px-4 py-1.5 text-xs font-semibold text-marino ring-1 ring-marino/15">
            <input
              type="checkbox"
              checked={aplicaIva}
              onChange={(e) => setAplicaIva(e.target.checked)}
              className="h-4 w-4 accent-marino"
            />
            Aplica Crédito Fiscal (IVA 13%)
          </label>
        </div>

        {/* Alertas de éxito o error */}
        {errorForm && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rosa/30 px-4 py-3 text-sm font-medium text-marino">
            <AlertCircle size={18} className="shrink-0 text-red-700" />
            <span>{errorForm}</span>
          </div>
        )}
        {mensajeOk && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-oliva/20 px-4 py-3 text-sm font-medium text-marino">
            <CheckCircle2 size={18} className="shrink-0 text-oliva" />
            <span>{mensajeOk}</span>
          </div>
        )}

        {/* Campos del encabezado (Maestro) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
              Proveedor *
            </label>
            <select
              value={idProveedor}
              onChange={(e) => setIdProveedor(e.target.value)}
              className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
              required
            >
              <option value="">-- Seleccionar proveedor --</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre} {p.nrc ? `(NRC: ${p.nrc})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
              Sucursal Destino *
            </label>
            <select
              value={idSucursal}
              onChange={(e) => setIdSucursal(e.target.value)}
              disabled={!esAdmin && Boolean(usuario.id_sucursal)}
              className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino disabled:opacity-65 focus:border-marino focus:outline-none"
              required
            >
              <option value="">-- Seleccionar sucursal --</option>
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
              N° Documento (CCF / Factura) *
            </label>
            <input
              type="text"
              maxLength={40}
              placeholder="Ej. CCF-001458"
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
              Fecha de Compra *
            </label>
            <input
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
              className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
              Condición de Pago *
            </label>
            <select
              value={condicionPago}
              onChange={(e) => setCondicionPago(e.target.value)}
              className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
            >
              <option value="CONTADO">CONTADO (Pagada al momento)</option>
              <option value="CREDITO">CRÉDITO (Genera Cuenta por Pagar)</option>
            </select>
          </div>

          {condicionPago === 'CREDITO' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-marino/75">
                Fecha de Vencimiento *
              </label>
              <input
                type="date"
                min={fechaCompra}
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                required
              />
            </div>
          )}
        </div>

        {/* Tabla dinámica de insumos comprados (Detalle) */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-marino">Detalle de Insumos Comprados</h3>
            <button
              type="button"
              onClick={agregarFila}
              className="inline-flex items-center gap-1.5 rounded-full bg-celeste px-3.5 py-1.5 text-xs font-semibold text-marino transition hover:brightness-95"
            >
              <Plus size={15} />
              Agregar línea
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-marino/15">
            <table className="w-full text-left text-sm">
              <thead className="bg-marino text-xs uppercase text-crema">
                <tr>
                  <th className="px-3 py-2.5">Insumo</th>
                  <th className="w-36 px-3 py-2.5">Cantidad</th>
                  <th className="w-40 px-3 py-2.5">Costo Unit. ($)</th>
                  <th className="w-36 px-3 py-2.5 text-right">Subtotal Línea</th>
                  <th className="w-14 px-3 py-2.5 text-center">Quitar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marino/10">
                {detalles.map((fila, idx) => {
                  const subLinea = r2((Number(fila.cantidad) || 0) * (Number(fila.costo_unitario) || 0));
                  return (
                    <tr key={idx} className="bg-white">
                      <td className="px-3 py-2">
                        <select
                          value={fila.id_insumo}
                          onChange={(e) => actualizarFila(idx, 'id_insumo', e.target.value)}
                          className="w-full rounded-lg border border-marino/20 bg-crema/40 px-2.5 py-1.5 text-sm text-marino focus:border-marino focus:outline-none"
                          required
                        >
                          <option value="">-- Seleccionar insumo --</option>
                          {insumos.map((ins) => (
                            <option key={ins.id_insumo} value={ins.id_insumo}>
                              {ins.nombre} ({ins.unidad_abreviatura || ins.unidad || 'und'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="0.000"
                          value={fila.cantidad}
                          onChange={(e) => actualizarFila(idx, 'cantidad', e.target.value)}
                          className="w-full rounded-lg border border-marino/20 bg-crema/40 px-2.5 py-1.5 text-right text-sm text-marino focus:border-marino focus:outline-none"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.00"
                          value={fila.costo_unitario}
                          onChange={(e) => actualizarFila(idx, 'costo_unitario', e.target.value)}
                          className="w-full rounded-lg border border-marino/20 bg-crema/40 px-2.5 py-1.5 text-right text-sm text-marino focus:border-marino focus:outline-none"
                          required
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-marino">
                        {moneda(subLinea)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => eliminarFila(idx)}
                          disabled={detalles.length === 1}
                          title="Eliminar línea"
                          className="rounded-lg p-1.5 text-marino/60 transition hover:bg-rosa/30 hover:text-red-700 disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resumen de totales y botón de guardado */}
        <div className="mt-6 flex flex-col items-end justify-between gap-4 border-t border-marino/10 pt-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-marino/65">Subtotal Neto: </span>
              <strong className="text-marino">{moneda(totales.subtotal)}</strong>
            </div>
            <div>
              <span className="text-marino/65">IVA (13%): </span>
              <strong className="text-marino">{moneda(totales.iva)}</strong>
            </div>
            <div className="text-base">
              <span className="font-semibold text-marino/80">Total Compra: </span>
              <strong className="text-lg font-extrabold text-marino">{moneda(totales.total)}</strong>
            </div>
          </div>

          <button
            type="submit"
            disabled={guardando}
            className="rounded-full bg-marino px-6 py-2.5 text-sm font-semibold text-crema shadow-sm transition hover:bg-marino/90 disabled:opacity-50"
          >
            {guardando ? 'Registrando compra...' : 'Guardar Compra e Ingresar Stock'}
          </button>
        </div>
      </form>

      {/* ── HISTORIAL DE COMPRAS REGISTRADAS ───────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-marino/10">
        <div className="mb-4 flex items-center gap-2">
          <FileText size={18} className="text-marino" />
          <h3 className="text-base font-bold text-marino">Últimas Compras Registradas</h3>
        </div>

        {comprasRecientes.length === 0 ? (
          <p className="py-6 text-center text-sm text-marino/60">
            Aún no hay compras registradas en esta sucursal.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-marino/15 text-xs uppercase text-marino/70">
                <tr>
                  <th className="px-3 py-2.5">Fecha</th>
                  <th className="px-3 py-2.5">Documento</th>
                  <th className="px-3 py-2.5">Proveedor</th>
                  <th className="px-3 py-2.5">Sucursal</th>
                  <th className="px-3 py-2.5">Condición</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marino/10">
                {comprasRecientes.map((c) => (
                  <tr key={c.id_compra} className="hover:bg-crema/60">
                    <td className="px-3 py-2.5 text-marino/80">{fechaCorta(c.fecha_compra)}</td>
                    <td className="px-3 py-2.5 font-semibold text-marino">{c.numero_documento}</td>
                    <td className="px-3 py-2.5 text-marino">{c.proveedor_nombre}</td>
                    <td className="px-3 py-2.5 text-marino/80">{c.sucursal_nombre}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.condicion_pago === 'CREDITO'
                            ? 'bg-rosa/35 text-marino'
                            : 'bg-celeste/50 text-marino'
                        }`}
                      >
                        {c.condicion_pago}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-marino">{moneda(c.total)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => verDetalle(c.id_compra)}
                        className="inline-flex items-center gap-1 rounded-full bg-crema px-3 py-1 text-xs font-semibold text-marino ring-1 ring-marino/20 transition hover:bg-celeste/40"
                      >
                        <Eye size={14} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL DE DETALLE DE COMPRA ─────────────────────────── */}
      {detalleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-marino/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-marino/10 pb-3">
              <h3 className="text-lg font-bold text-marino">
                {cargandoModal ? 'Cargando factura...' : `Compra ${detalleModal.numero_documento}`}
              </h3>
              <button
                type="button"
                onClick={() => setDetalleModal(null)}
                className="rounded-full p-1 text-marino/60 hover:bg-marino/10 hover:text-marino"
              >
                <X size={20} />
              </button>
            </div>

            {!cargandoModal && detalleModal.id_compra && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-crema p-4">
                  <div>
                    <span className="text-xs text-marino/60">Proveedor:</span>
                    <p className="font-semibold text-marino">{detalleModal.proveedor_nombre}</p>
                  </div>
                  <div>
                    <span className="text-xs text-marino/60">Sucursal:</span>
                    <p className="font-semibold text-marino">{detalleModal.sucursal_nombre}</p>
                  </div>
                  <div>
                    <span className="text-xs text-marino/60">Fecha Compra:</span>
                    <p className="font-semibold text-marino">{fechaCorta(detalleModal.fecha_compra)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-marino/60">Condición:</span>
                    <p className="font-semibold text-marino">{detalleModal.condicion_pago}</p>
                  </div>
                </div>

                <table className="w-full text-left text-xs">
                  <thead className="bg-marino text-crema">
                    <tr>
                      <th className="px-3 py-2">Insumo</th>
                      <th className="px-3 py-2 text-right">Cantidad</th>
                      <th className="px-3 py-2 text-right">Costo Unit.</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-marino/10">
                    {(detalleModal.detalles || []).map((d) => (
                      <tr key={d.id_compra_detalle}>
                        <td className="px-3 py-2 font-medium text-marino">{d.insumo_nombre}</td>
                        <td className="px-3 py-2 text-right">
                          {Number(d.cantidad)} {d.unidad_abreviatura}
                        </td>
                        <td className="px-3 py-2 text-right">{moneda(d.costo_unitario)}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {moneda(Number(d.cantidad) * Number(d.costo_unitario))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end gap-6 border-t border-marino/10 pt-3 text-sm">
                  <span>Subtotal: <strong>{moneda(detalleModal.subtotal)}</strong></span>
                  <span>IVA: <strong>{moneda(detalleModal.iva)}</strong></span>
                  <span className="text-base">Total: <strong>{moneda(detalleModal.total)}</strong></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}