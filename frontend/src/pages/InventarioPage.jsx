
import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw } from 'lucide-react';

import Tabla from '../components/ui/Tabla.jsx';
import Paginacion from '../components/ui/Paginacion.jsx';
import CampoFormulario from '../components/ui/CampoFormulario.jsx';

import {
  listarProductosInventario
} from '../services/productosService';

const REGISTROS_POR_PAGINA = 10;

export default function InventarioPage() {

  const [pestana, setPestana] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  async function cargarProductos() {
    try {
      setCargando(true);
      setError('');

      const datos = await listarProductosInventario();

      if (!Array.isArray(datos)) {
        throw new Error('Formato de productos no válido.');
      }

      setProductos(datos);
      setPagina(1);

    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarProductos();
  }, []);

  const productosFiltrados = productos.filter((producto) => {

    const coincideBusqueda =
      `${producto.nombre} ${producto.categoria}`
        .toLowerCase()
        .includes(busqueda.toLowerCase().trim());

    const coincideEstado =
      estado === 'todos' ||
      (estado === 'activos' && producto.activo) ||
      (estado === 'inactivos' && !producto.activo);

    return coincideBusqueda && coincideEstado;
  });

  const inicio = (pagina - 1) * REGISTROS_POR_PAGINA;

  const productosPagina = productosFiltrados.slice(
    inicio,
    inicio + REGISTROS_POR_PAGINA
  );

  const columnas = [
    {
      campo: 'id_producto',
      titulo: 'ID'
    },
    {
      campo: 'nombre',
      titulo: 'Producto'
    },
    {
      campo: 'categoria',
      titulo: 'Categoría'
    },
    {
      campo: 'precio_venta',
      titulo: 'Precio',
      render: (producto) =>
        `$${Number(producto.precio_venta).toFixed(2)}`
    },
    {
      campo: 'activo',
      titulo: 'Estado',
      render: (producto) => (
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          producto.activo
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {producto.activo ? 'Activo' : 'Inactivo'}
        </span>
      )
    },
    {
      campo: 'acciones',
      titulo: 'Acciones',
      render: (producto) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-celeste/40"
            title="Editar producto"
            aria-label={`Editar ${producto.nombre}`}
            onClick={() => console.log('Editar:', producto)}
          >
            <Pencil size={18} />
          </button>

          {producto.activo && (
            <button
              type="button"
              className="rounded-lg p-2 text-red-600 hover:bg-red-100"
              title="Dar de baja"
              aria-label={`Dar de baja ${producto.nombre}`}
              onClick={() => console.log('Dar de baja:', producto)}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      )
    }
  ];

  const pestanas = [
    { id: 'productos', nombre: 'Productos' },
    { id: 'existencias', nombre: 'Existencias' },
    { id: 'movimientos', nombre: 'Movimientos' }
  ];

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-3xl font-bold">
          Inventario
        </h1>
        <p className="mt-1 text-sm text-oliva">
          Administración de productos, recetas y existencias.
        </p>
      </div>

      {/* Pestañas de navegación */}
      <div className="flex flex-wrap gap-2 border-b border-oliva/30 pb-3">
        {pestanas.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPestana(item.id)}
            className={
              pestana === item.id
                ? 'btn-oscuro'
                : 'btn-claro'
            }
          >
            {item.nombre}
          </button>
        ))}
      </div>

      {pestana === 'productos' && (
        <section className="space-y-4">

          {/* Encabezado */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">
              Gestión de productos
            </h2>

            <button
              type="button"
              className="btn-oscuro flex items-center gap-2"
              onClick={() => console.log('Nuevo producto')}
            >
              <Plus size={18} />
              Nuevo producto
            </button>
          </div>

          {/* Indicadores */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            <div className="rounded-xl border border-oliva/30 p-4">
              <p className="text-sm text-oliva">
                Total de productos
              </p>
              <p className="mt-2 text-3xl font-bold">
                {productos.length}
              </p>
            </div>

            <div className="rounded-xl border border-oliva/30 p-4">
              <p className="text-sm text-oliva">
                Productos activos
              </p>
              <p className="mt-2 text-3xl font-bold text-green-700">
                {productos.filter(p => p.activo).length}
              </p>
            </div>

            <div className="rounded-xl border border-oliva/30 p-4">
              <p className="text-sm text-oliva">
                Productos inactivos
              </p>
              <p className="mt-2 text-3xl font-bold text-red-600">
                {productos.filter(p => !p.activo).length}
              </p>
            </div>

          </div>

          {/* Buscador y filtros */}
          <div className="flex flex-wrap items-end gap-3">

            <div className="min-w-[220px] flex-1">
              <CampoFormulario
                id="buscar"
                etiqueta="Buscar producto"
              >
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-3 text-oliva"
                  />

                  <input
                    id="buscar"
                    type="text"
                    className="campo pl-10"
                    placeholder="Nombre o categoría..."
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      setPagina(1);
                    }}
                  />
                </div>
              </CampoFormulario>
            </div>

            <CampoFormulario id="estado" etiqueta="Estado">
              <select
                id="estado"
                className="campo"
                value={estado}
                onChange={(e) => {
                  setEstado(e.target.value);
                  setPagina(1);
                }}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </CampoFormulario>

            <button
              type="button"
              className="btn-claro flex items-center gap-2"
              onClick={cargarProductos}
              disabled={cargando}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>

          </div>

          {/* Resultados de la API */}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-100 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : cargando ? (
            <div className="py-10 text-center text-oliva">
              Cargando productos...
            </div>
          ) : (
            <>
              <Tabla
                columnas={columnas}
                datos={productosPagina}
                clave="id_producto"
                mensajeVacio="No se encontraron productos."
              />

              <Paginacion
                pagina={pagina}
                totalRegistros={productosFiltrados.length}
                registrosPorPagina={REGISTROS_POR_PAGINA}
                onCambiarPagina={setPagina}
              />
            </>
          )}

        </section>
      )}

      {pestana === 'existencias' && (
        <section className="rounded-xl border border-oliva/30 p-8">
          <h2 className="text-xl font-bold">
            Existencias por sucursal
          </h2>
          <p className="mt-2 text-oliva">
            Módulo en desarrollo.
          </p>
        </section>
      )}

      {pestana === 'movimientos' && (
        <section className="rounded-xl border border-oliva/30 p-8">
          <h2 className="text-xl font-bold">
            Movimientos de inventario
          </h2>
          <p className="mt-2 text-oliva">
            Módulo en desarrollo.
          </p>
        </section>
      )}

    </div>
  );
}
