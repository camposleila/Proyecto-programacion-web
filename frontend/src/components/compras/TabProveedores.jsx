import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, UserX, CheckCircle2, AlertCircle, X } from 'lucide-react';
import {
  listarProveedores,
  crearProveedor,
  actualizarProveedor,
  desactivarProveedor
} from '../../services/comprasService';
import {
  formatearNIT,
  nitValido,
  formatearNRC,
  nrcValido,
  emailValido
} from '../../utils/formatos';

const FORM_INICIAL = {
  nombre: '',
  nit: '',
  nrc: '',
  telefono: '',
  correo: '',
  activo: true
};

export default function TabProveedores() {
  // ── ESTADOS DE LISTADO Y FILTROS ─────────────────────────────
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mensajeOk, setMensajeOk] = useState('');
  const [errorGeneral, setErrorGeneral] = useState('');

  // ── ESTADOS DEL MODAL CREAR / EDITAR ─────────────────────────
  const [modalAbierto, setModalAbierto] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState('');

  // Consulta GET /api/proveedores con búsqueda y filtro de activos/todos
  async function cargarProveedores() {
    setCargando(true);
    setErrorGeneral('');
    try {
      const lista = await listarProveedores({
        todos: mostrarInactivos,
        buscar: busqueda
      });
      setProveedores(lista);
    } catch (err) {
      setErrorGeneral(err.message || 'No se pudo cargar el catálogo de proveedores.');
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      cargarProveedores();
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, mostrarInactivos]);

  // Abre modal limpio para registrar un proveedor nuevo
  function abrirCrear() {
    setIdEditando(null);
    setForm(FORM_INICIAL);
    setErrorModal('');
    setModalAbierto(true);
  }

  // Abre modal precargado con los datos del proveedor seleccionado
  function abrirEditar(prov) {
    setIdEditando(prov.id_proveedor);
    setForm({
      nombre: prov.nombre || '',
      nit: prov.nit || '',
      nrc: prov.nrc || '',
      telefono: prov.telefono || '',
      correo: prov.correo || '',
      activo: Boolean(prov.activo)
    });
    setErrorModal('');
    setModalAbierto(true);
  }

  // Guarda (POST o PUT) validando formatos fiscales salvadoreños
  async function manejarGuardar(e) {
    e.preventDefault();
    setErrorModal('');

    if (!form.nombre.trim()) {
      return setErrorModal('El nombre o razón social del proveedor es obligatorio.');
    }
    if (form.nit.trim() && !nitValido(form.nit)) {
      return setErrorModal('El NIT debe tener 14 dígitos (formato 0000-000000-000-0).');
    }
    if (form.nrc.trim() && !nrcValido(form.nrc)) {
      return setErrorModal('El NRC debe tener entre 6 y 8 dígitos.');
    }
    if (form.correo.trim() && !emailValido(form.correo.trim())) {
      return setErrorModal('El formato del correo electrónico no es válido.');
    }

    setGuardando(true);
    try {
      if (idEditando) {
        const resp = await actualizarProveedor(idEditando, form);
        setMensajeOk(resp?.mensaje || 'Proveedor actualizado correctamente.');
      } else {
        const resp = await crearProveedor(form);
        setMensajeOk(resp?.mensaje || 'Proveedor registrado correctamente.');
      }
      setModalAbierto(false);
      await cargarProveedores();
    } catch (err) {
      setErrorModal(err.message || 'No se pudo guardar el proveedor.');
    } finally {
      setGuardando(false);
    }
  }

  // Ejecuta borrado lógico (DELETE /api/proveedores/:id -> activo = FALSE)
  async function manejarDesactivar(prov) {
    if (!window.confirm(`¿Deseas desactivar al proveedor "${prov.nombre}"?`)) return;
    setErrorGeneral('');
    setMensajeOk('');
    try {
      const resp = await desactivarProveedor(prov.id_proveedor);
      setMensajeOk(resp?.mensaje || `Proveedor "${prov.nombre}" desactivado.`);
      await cargarProveedores();
    } catch (err) {
      setErrorGeneral(err.message || 'No se pudo desactivar el proveedor.');
    }
  }

  return (
    <div className="space-y-5">
      {/* ── BARRA DE BÚSQUEDA Y BOTÓN NUEVO PROVEEDOR ──────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-marino/10">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marino/45" />
            <input
              type="text"
              placeholder="Buscar por nombre, NIT, NRC o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-full border border-marino/20 bg-crema/50 py-2 pl-9 pr-4 text-sm text-marino focus:border-marino focus:outline-none"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-marino/80">
            <input
              type="checkbox"
              checked={mostrarInactivos}
              onChange={(e) => setMostrarInactivos(e.target.checked)}
              className="h-4 w-4 accent-marino"
            />
            Mostrar inactivos
          </label>
        </div>

        <button
          type="button"
          onClick={abrirCrear}
          className="inline-flex items-center gap-2 rounded-full bg-marino px-5 py-2.5 text-xs font-semibold text-crema shadow-sm transition hover:bg-marino/90"
        >
          <Plus size={16} />
          Nuevo Proveedor
        </button>
      </div>

      {/* Alertas */}
      {errorGeneral && (
        <div className="flex items-center gap-2 rounded-xl bg-rosa/30 px-4 py-3 text-sm font-medium text-marino">
          <AlertCircle size={18} className="shrink-0 text-red-700" />
          <span>{errorGeneral}</span>
        </div>
      )}
      {mensajeOk && (
        <div className="flex items-center gap-2 rounded-xl bg-oliva/20 px-4 py-3 text-sm font-medium text-marino">
          <CheckCircle2 size={18} className="shrink-0 text-oliva" />
          <span>{mensajeOk}</span>
        </div>
      )}

      {/* ── TABLA DE PROVEEDORES ───────────────────────────────── */}
      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-marino/10">
        {cargando ? (
          <p className="py-8 text-center text-sm text-marino/65">Cargando proveedores...</p>
        ) : proveedores.length === 0 ? (
          <p className="py-8 text-center text-sm text-marino/65">
            No se encontraron proveedores con los criterios actuales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-marino/15 text-xs uppercase text-marino/70">
                <tr>
                  <th className="px-3 py-2.5">Nombre / Razón Social</th>
                  <th className="px-3 py-2.5">NIT</th>
                  <th className="px-3 py-2.5">NRC</th>
                  <th className="px-3 py-2.5">Teléfono</th>
                  <th className="px-3 py-2.5">Correo</th>
                  <th className="px-3 py-2.5 text-center">Estado</th>
                  <th className="px-3 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marino/10">
                {proveedores.map((p) => (
                  <tr key={p.id_proveedor} className="hover:bg-crema/60">
                    <td className="px-3 py-3 font-semibold text-marino">{p.nombre}</td>
                    <td className="px-3 py-3 text-marino/80">{p.nit || '—'}</td>
                    <td className="px-3 py-3 text-marino/80">{p.nrc || '—'}</td>
                    <td className="px-3 py-3 text-marino/80">{p.telefono || '—'}</td>
                    <td className="px-3 py-3 text-marino/80">{p.correo || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          p.activo ? 'bg-oliva/25 text-marino' : 'bg-rosa/40 text-marino'
                        }`}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => abrirEditar(p)}
                          title="Editar proveedor"
                          className="rounded-full bg-crema p-2 text-marino ring-1 ring-marino/15 transition hover:bg-celeste/50"
                        >
                          <Pencil size={14} />
                        </button>
                        {p.activo && (
                          <button
                            type="button"
                            onClick={() => manejarDesactivar(p)}
                            title="Desactivar proveedor"
                            className="rounded-full bg-crema p-2 text-marino ring-1 ring-marino/15 transition hover:bg-rosa/40 hover:text-red-700"
                          >
                            <UserX size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL CREAR / EDITAR PROVEEDOR ─────────────────────── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-marino/50 p-4">
          <form
            onSubmit={manejarGuardar}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-marino/10 pb-3">
              <h3 className="text-lg font-bold text-marino">
                {idEditando ? 'Editar Proveedor' : 'Registrar Nuevo Proveedor'}
              </h3>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-full p-1 text-marino/60 hover:bg-marino/10 hover:text-marino"
              >
                <X size={20} />
              </button>
            </div>

            {errorModal && (
              <div className="mb-3 rounded-xl bg-rosa/30 px-3 py-2 text-xs font-medium text-red-800">
                {errorModal}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  Nombre o Razón Social *
                </label>
                <input
                  type="text"
                  maxLength={150}
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej. Distribuidora La Constancia S.A. de C.V."
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  NIT (El Salvador)
                </label>
                <input
                  type="text"
                  value={form.nit}
                  onChange={(e) => setForm({ ...form, nit: formatearNIT(e.target.value) })}
                  placeholder="0614-150590-102-3"
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  NRC
                </label>
                <input
                  type="text"
                  value={form.nrc}
                  onChange={(e) => setForm({ ...form, nrc: formatearNRC(e.target.value) })}
                  placeholder="123456-7"
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  Teléfono
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="2222-0000"
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-marino/75">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  maxLength={120}
                  value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })}
                  placeholder="ventas@proveedor.com"
                  className="w-full rounded-xl border border-marino/20 bg-crema/50 px-3 py-2.5 text-sm text-marino focus:border-marino focus:outline-none"
                />
              </div>

              {idEditando && (
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-marino">
                    <input
                      type="checkbox"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                      className="h-4 w-4 accent-marino"
                    />
                    Proveedor activo en el sistema
                  </label>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="rounded-full bg-crema px-4 py-2 text-xs font-semibold text-marino ring-1 ring-marino/20 hover:bg-marino/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-full bg-marino px-5 py-2 text-xs font-semibold text-crema hover:bg-marino/90 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : idEditando ? 'Guardar Cambios' : 'Registrar Proveedor'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}