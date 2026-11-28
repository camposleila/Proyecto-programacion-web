import { useEffect, useState } from 'react';
import {
  Search,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';

import Tabla from '../ui/Tabla.jsx';
import Paginacion from '../ui/Paginacion.jsx';
import CampoFormulario from '../ui/CampoFormulario.jsx';

import { listarMovimientos } from '../../services/inventarioService';
import { listarSucursales } from '../../services/catalogosService';

const REGISTROS_POR_PAGINA = 10;

const TIPOS = {
  COMPRA: 'Compra',
  VENTA: 'Venta',
  AJUSTE: 'Ajuste',
  ANULACION: 'Anulación'
};

const ESTILOS = {
  COMPRA: 'bg-green-100 text-green-700',
  VENTA: 'bg-blue-100 text-blue-700',
  AJUSTE: 'bg-amber-100 text-amber-700',
  ANULACION: 'bg-purple-100 text-purple-700'
};

export default function TablaMovimientos() {

  const [movimientos, setMovimientos] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const [sucursal, setSucursal] = useState('');
  const [tipo, setTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  // Consultar los movimientos desde el backend.
  useEffect(() => {
    let vigente = true;

    async function cargarDatos() {
      try {
        setCargando(true);
        setError('');

        const [datos, listaSucursales] = await Promise.all([
          listarMovimientos(sucursal, tipo),
          listarSucursales()
        ]);

        if (!Array.isArray(datos)) {
          throw new Error('Formato de movimientos no válido.');
        }

        if (vigente) {
          setMovimientos(datos);
          setSucursales(listaSucursales);
          setPagina(1);
        }

      } catch (err) {
        if (vigente) {
          setError(err.message);
        }
      } finally {
        if (vigente) {
          setCargando(false);
        }
      }
    }

    cargarDatos();

    return () => {
      vigente = false;
    };

  }, [sucursal, tipo, actualizacion]);

  // Buscar por insumo, sucursal o referencia.
  const movimientosFiltrados = movimientos.filter(item =>
    `${item.insumo} ${item.sucursal} ${item.referencia || ''}`
      .toLowerCase()
      .includes(busqueda.toLowerCase().trim())
  );

  // Contar entradas y salidas.
  const entradas = movimientos.filter(
    item => Number(item.cantidad) > 0
  ).length;

  const salidas = movimientos.filter(
    item => Number(item.cantidad) < 0
  ).length;

  // Paginación.
  const inicio = (pagina - 1) * REGISTROS_POR_PAGINA;

  const movimientosPagina = movimientosFiltrados.slice(
    inicio,
    inicio + REGISTROS_POR_PAGINA
  );

  // Columnas de la tabla.
  const columnas = [
    {
      campo: 'fecha',
      titulo: 'Fecha y hora',
      render: item =>
        new Date(item.fecha).toLocaleString('es-SV', {
          timeZone: 'America/El_Salvador',
          dateStyle: 'short',
          timeStyle: 'short'
        })
    },
    {
      campo: 'insumo',
      titulo: 'Insumo'
    },
    {
      campo: 'sucursal',
      titulo: 'Sucursal'
    },
    {
      campo: 'tipo_movimiento',
      titulo: 'Tipo',
      render: item => (
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          ESTILOS[item.tipo_movimiento] || ''
        }`}>
          {TIPOS[item.tipo_movimiento] || item.tipo_movimiento}
        </span>
      )
    },
    {
      campo: 'cantidad',
      titulo: 'Cantidad',
      render: item => {
        const cantidad = Number(item.cantidad);

        return (
          <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${
            cantidad > 0
              ? 'text-green-700'
              : 'text-red-600'
          }`}>

            {cantidad > 0
              ? <ArrowDownLeft size={16} />
              : <ArrowUpRight size={16} />
            }

            {cantidad > 0 ? '+' : ''}

            {cantidad.toLocaleString('en-US', {
              maximumFractionDigits: 3
            })} {item.abreviatura}

          </span>
        );
      }
    },
    {
      campo: 'referencia',
      titulo: 'Referencia',
      render: item => item.referencia || '—'
    },
    {
      campo: 'id_usuario',
      titulo: 'Usuario ID',
      render: item => item.id_usuario ?? '—'
    }
  ];

  return (
    <section className="space-y-4">

      <div>
        <h2 className="text-xl font-bold">
          Movimientos de inventario
        </h2>

        <p className="mt-1 text-sm text-oliva">
          Historial de entradas, salidas y ajustes por sucursal.
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        <div className="rounded-xl border border-oliva/30 p-4">
          <p className="text-sm text-oliva">
            Total de movimientos
          </p>

          <p className="mt-2 text-3xl font-bold">
            {cargando || error ? '—' : movimientos.length}
          </p>
        </div>

        <div className="rounded-xl border border-oliva/30 p-4">
          <p className="text-sm text-oliva">
            Entradas de inventario
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {cargando || error ? '—' : entradas}
          </p>
        </div>

        <div className="rounded-xl border border-oliva/30 p-4">
          <p className="text-sm text-oliva">
            Salidas de inventario
          </p>

          <p className="mt-2 text-3xl font-bold text-red-600">
            {cargando || error ? '—' : salidas}
          </p>
        </div>

      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">

        <CampoFormulario
          id="sucursalMovimiento"
          etiqueta="Sucursal"
        >
          <select
            id="sucursalMovimiento"
            className="campo"
            value={sucursal}
            onChange={e => {
              setSucursal(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todas las sucursales</option>

            {sucursales.map(item => (
              <option
                key={item.id_sucursal}
                value={item.id_sucursal}
              >
                {item.nombre}
              </option>
            ))}
          </select>
        </CampoFormulario>

        <CampoFormulario
          id="tipoMovimiento"
          etiqueta="Tipo de movimiento"
        >
          <select
            id="tipoMovimiento"
            className="campo"
            value={tipo}
            onChange={e => {
              setTipo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos</option>
            <option value="COMPRA">Compra</option>
            <option value="VENTA">Venta</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="ANULACION">Anulación</option>
          </select>
        </CampoFormulario>

        <div className="min-w-[220px] flex-1">
          <CampoFormulario
            id="buscarMovimiento"
            etiqueta="Buscar movimiento"
          >
            <div className="relative">

              <Search
                size={18}
                className="absolute left-3 top-3 text-oliva"
              />

              <input
                id="buscarMovimiento"
                type="text"
                className="campo pl-10"
                placeholder="Insumo o referencia..."
                value={busqueda}
                onChange={e => {
                  setBusqueda(e.target.value);
                  setPagina(1);
                }}
              />

            </div>
          </CampoFormulario>
        </div>

        <button
          type="button"
          className="btn-claro flex items-center gap-2"
          onClick={() => setActualizacion(valor => valor + 1)}
          disabled={cargando}
        >
          <RefreshCw
            size={16}
            className={cargando ? 'animate-spin' : ''}
          />
          Actualizar
        </button>

      </div>

      {/* Tabla de resultados */}
      {error ? (
        <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : cargando ? (
        <div className="py-10 text-center text-oliva">
          Cargando movimientos...
        </div>
      ) : (
        <>

          <Tabla
            columnas={columnas}
            datos={movimientosPagina}
            clave="id_movimiento"
            mensajeVacio="No se encontraron movimientos de inventario."
          />

          <Paginacion
            pagina={pagina}
            totalRegistros={movimientosFiltrados.length}
            registrosPorPagina={REGISTROS_POR_PAGINA}
            onCambiarPagina={setPagina}
          />

        </>
      )}

    </section>
  );
}
