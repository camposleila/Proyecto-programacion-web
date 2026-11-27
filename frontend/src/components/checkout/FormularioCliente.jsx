import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2, Plus, Search, UserRound, X } from 'lucide-react';
import { filtrarClientes, listarClientes } from '../../services/clientesService';
import { formatearDUI, formatearIdCliente, formatearNIT, formatearNRC } from '../../utils/formatos';

export const CLIENTE_VACIO = {
  id_cliente: '', nombre: '', dui: '', email: '', nit: '', nrc: '', giro: '', direccion: '',
  tipo_identificacion: 'dui'
};

const Campo = ({ etiqueta, error, children }) => (
  <div>
    <label className="etiqueta">{etiqueta}</label>
    {children}
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
);

// Bloque "Datos de facturación" (parte del cliente). Cambia según FACTURA o CCF.
export default function FormularioCliente({ tipo, cliente, onChange, errores = {} }) {
  const [consulta, setConsulta] = useState('');
  const [clientes, setClientes] = useState(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [avisoBusqueda, setAvisoBusqueda] = useState('');
  const [modoPerfil, setModoPerfil] = useState(false);
  const esCCF = tipo === 'CCF';
  const tipoIdentificacion = cliente.tipo_identificacion || 'dui';
  const clienteSeleccionado = Boolean(cliente.id_cliente && !modoPerfil);
  const sugerencias = useMemo(
    () => filtrarClientes(clientes || [], consulta),
    [clientes, consulta]
  );

  useEffect(() => {
    if (cliente.id_cliente && modoPerfil) {
      setConsulta(formatearIdCliente(cliente.id_cliente));
      setModoPerfil(false);
      setMenuAbierto(false);
    }
  }, [cliente.id_cliente, modoPerfil]);

  const cargarClientes = async () => {
    if (clientes) return;
    setBuscando(true);
    setAvisoBusqueda('');
    try {
      setClientes(await listarClientes());
    } catch (e) {
      setAvisoBusqueda(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const seleccionar = (c) => {
    onChange({
      id_cliente: c.id_cliente,
      nombre: c.nombre || '',
      dui: c.dui || '',
      email: c.email || '',
      nit: c.nit || '',
      nrc: c.nrc || '',
      giro: c.giro || '',
      direccion: c.direccion || '',
      tipo_identificacion: c.nit && !c.dui ? 'nit' : 'dui'
    });
    setConsulta(formatearIdCliente(c.id_cliente));
    setModoPerfil(false);
    setMenuAbierto(false);
    setAvisoBusqueda('');
  };

  const crearPerfil = () => {
    const textoEsId = /^cl-/i.test(consulta.trim()) || /^\d+$/.test(consulta.trim());
    onChange({
      ...CLIENTE_VACIO,
      nombre: textoEsId ? '' : consulta.trim()
    });
    setModoPerfil(true);
    setMenuAbierto(false);
    setAvisoBusqueda('');
  };

  const cambiarCliente = () => {
    onChange({ ...CLIENTE_VACIO });
    setConsulta('');
    setModoPerfil(false);
    setMenuAbierto(true);
  };

  const setDato = (campo, valor) => onChange({ ...cliente, [campo]: valor });

  const campoBusqueda = (
    <Campo etiqueta="Buscar cliente por nombre o ID">
      <div className="relative">
        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-oliva" />
        <input
          id="buscar-cliente"
          role="combobox"
          aria-expanded={menuAbierto}
          aria-controls="opciones-clientes"
          aria-autocomplete="list"
          autoComplete="off"
          className="campo pl-10 pr-10"
          readOnly={clienteSeleccionado}
          placeholder="Nombre o CL-0000-0000-0001"
          value={consulta}
          onFocus={() => { setMenuAbierto(true); cargarClientes(); }}
          onBlur={() => setMenuAbierto(false)}
          onChange={(e) => { setConsulta(e.target.value); setMenuAbierto(true); setAvisoBusqueda(''); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMenuAbierto(false);
            if (e.key === 'Enter') {
              e.preventDefault();
              if (consulta.trim() && sugerencias[0]) seleccionar(sugerencias[0]);
              else if (consulta.trim()) crearPerfil();
            }
          }}
        />
        {buscando
          ? <Loader2 size={16} aria-label="Cargando clientes" className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-oliva" />
          : <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-oliva" />}
        {menuAbierto && !clienteSeleccionado && (
          <div
            id="opciones-clientes"
            role="listbox"
            className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-oliva/30 bg-crema p-1.5 shadow-xl"
          >
            {sugerencias.map((c) => (
              <button
                key={c.id_cliente}
                type="button"
                role="option"
                aria-selected="false"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => seleccionar(c)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-celeste/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                  <span className="block text-xs text-oliva">{formatearIdCliente(c.id_cliente)}</span>
                </span>
                <UserRound size={16} aria-hidden="true" className="shrink-0 text-oliva" />
              </button>
            ))}
            {consulta.trim() && sugerencias.length === 0 && !buscando && clientes && (
              <p className="px-3 py-2 text-sm text-oliva">No hay coincidencias por nombre o ID.</p>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={crearPerfil}
              className="flex w-full items-center gap-2 rounded-lg border-t border-oliva/20 px-3 py-2.5 text-left text-sm font-semibold text-marino hover:bg-celeste/40"
            >
              <Plus size={16} aria-hidden="true" />
              Crear perfil de cliente
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-oliva">La búsqueda no utiliza DUI ni NIT.</p>
      {avisoBusqueda && <p role="alert" className="mt-1 text-xs text-red-600">{avisoBusqueda}</p>}
    </Campo>
  );

  const campoNombre = (
    <Campo etiqueta={esCCF ? 'Nombre del cliente / razón social *' : 'Nombre del cliente'} error={errores.nombre}>
      <input className="campo" placeholder="Ej. María José Hernández" value={cliente.nombre} readOnly={clienteSeleccionado} onChange={(e) => setDato('nombre', e.target.value)} />
    </Campo>
  );

  const campoEmail = (
    <Campo etiqueta="Email" error={errores.email}>
      <input type="email" className="campo" placeholder="Ej. maria.hernandez@correo.com" value={cliente.email} readOnly={clienteSeleccionado} onChange={(e) => setDato('email', e.target.value)} />
    </Campo>
  );

  return (
    <div className="space-y-3">
      {campoBusqueda}
      {clienteSeleccionado && (
        <div className="flex items-center justify-between rounded-xl border border-oliva/25 bg-oliva/5 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Check size={16} aria-hidden="true" className="shrink-0 text-oliva" />
            <span className="truncate text-sm font-semibold">Perfil seleccionado · {formatearIdCliente(cliente.id_cliente)}</span>
          </div>
          <button type="button" onClick={cambiarCliente} className="ml-2 flex shrink-0 items-center gap-1 text-xs font-semibold text-marino hover:underline">
            <X size={14} aria-hidden="true" /> Cambiar
          </button>
        </div>
      )}
      {!clienteSeleccionado && modoPerfil && (
        <div className="flex items-center justify-between rounded-xl bg-celeste/40 px-3 py-2 text-sm">
          <span className="font-semibold">Nuevo perfil de cliente</span>
          <button type="button" onClick={cambiarCliente} className="font-semibold text-marino hover:underline">Cancelar</button>
        </div>
      )}
      {campoNombre}
      {campoEmail}
      {!esCCF ? (
        <>
          <Campo etiqueta="Documento de identidad">
            <div className="mb-2 flex gap-2" role="group" aria-label="Tipo de identificación del cliente natural">
              {[
                ['dui', 'DUI'],
                ['nit', 'NIT']
              ].map(([valor, texto]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={tipoIdentificacion === valor}
                  onClick={() => setDato('tipo_identificacion', valor)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                    tipoIdentificacion === valor ? 'border-marino bg-marino text-crema' : 'border-oliva/40 hover:bg-oliva/10'
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>
            {tipoIdentificacion === 'dui' ? (
              <input aria-label="DUI del cliente" className="campo" placeholder="01234567-8" value={cliente.dui} readOnly={clienteSeleccionado} onChange={(e) => setDato('dui', formatearDUI(e.target.value))} />
            ) : (
              <input aria-label="NIT del cliente natural" className="campo" placeholder="0614-150590-102-3" value={cliente.nit} readOnly={clienteSeleccionado} onChange={(e) => setDato('nit', formatearNIT(e.target.value))} />
            )}
            {errores.dui && tipoIdentificacion === 'dui' && <p className="mt-1 text-xs text-red-600">{errores.dui}</p>}
            {errores.nit && tipoIdentificacion === 'nit' && <p className="mt-1 text-xs text-red-600">{errores.nit}</p>}
          </Campo>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="NIT *" error={errores.nit}>
              <input className="campo" placeholder="0614-150590-102-3" value={cliente.nit} readOnly={clienteSeleccionado} onChange={(e) => setDato('nit', formatearNIT(e.target.value))} />
            </Campo>
            <Campo etiqueta="NRC *" error={errores.nrc}>
              <input className="campo" placeholder="123456-7" value={cliente.nrc} readOnly={clienteSeleccionado} onChange={(e) => setDato('nrc', formatearNRC(e.target.value))} />
            </Campo>
          </div>
          <Campo etiqueta="DUI (opcional)" error={errores.dui}>
            <input className="campo" placeholder="01234567-8" value={cliente.dui} readOnly={clienteSeleccionado} onChange={(e) => setDato('dui', formatearDUI(e.target.value))} />
          </Campo>
          <Campo etiqueta="Giro *" error={errores.giro}>
            <input className="campo" placeholder="Ej. Venta al por menor de alimentos y bebidas" value={cliente.giro} readOnly={clienteSeleccionado} onChange={(e) => setDato('giro', e.target.value)} />
          </Campo>
          <Campo etiqueta="Dirección *" error={errores.direccion}>
            <input className="campo" placeholder="Ej. Col. Escalón, 87 Av. Norte, San Salvador" value={cliente.direccion} readOnly={clienteSeleccionado} onChange={(e) => setDato('direccion', e.target.value)} />
          </Campo>
        </>
      )}
    </div>
  );
}
