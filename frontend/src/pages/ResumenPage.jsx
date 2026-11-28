import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DollarSign,
  Receipt,
  Package,
  AlertTriangle,
  ShoppingCart,
  RefreshCw,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

import TarjetaIndicador from '../components/dashboard/TarjetaIndicador.jsx';
import GraficoVentas from '../components/dashboard/GraficoVentas.jsx';
import CampoFormulario from '../components/ui/CampoFormulario.jsx';
import Tabla from '../components/ui/Tabla.jsx';

import { listarVentasResumen } from '../services/ventasService';
import { listarProductosInventario } from '../services/productosService';
import { listarExistencias } from '../services/inventarioService';
import { listarSucursales } from '../services/catalogosService';

const ZONA_HORARIA = 'America/El_Salvador';

const formatoMoneda = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

// Obtener la fecha en horario de El Salvador.
function fechaLocal(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(fecha);

  const obtener = tipo =>
    partes.find(p => p.type === tipo).value;

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

// Generar las fechas de los últimos siete días.
function ultimosSieteDias() {
  const hoy = new Date();

  return Array.from({ length: 7 }, (_, indice) => {
    const fecha = new Date(
      hoy.getTime() - (6 - indice) * 86400000
    );

    return {
      fecha: fechaLocal(fecha),
      etiqueta: fecha.toLocaleDateString('es-SV', {
        weekday: 'short',
        day: 'numeric',
        timeZone: ZONA_HORARIA
      }),
      total: 0
    };
  });
}

export default function ResumenPage() {

  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [sucursales, setSucursales] = useState([]);

  const [sucursal, setSucursal] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [actualizacion, setActualizacion] = useState(0);

  // Consultar todos los datos del dashboard.
  useEffect(() => {
    let vigente = true;

    async function cargarDatos() {
      try {
        setCargando(true);
        setError('');

        const dias = ultimosSieteDias();

        const fechaDesde =
          `${dias[0].fecha}T00:00:00-06:00`;

        const resultados = await Promise.all([
          listarVentasResumen(sucursal, fechaDesde),
          listarProductosInventario(),
          listarExistencias(sucursal),
          listarSucursales()
        ]);

        if (!resultados.every(Array.isArray)) {
          throw new Error(
            'La API devolvió un formato de datos no válido.'
          );
        }

        if (vigente) {
          setVentas(resultados[0]);
          setProductos(resultados[1]);
          setExistencias(resultados[2]);
          setSucursales(resultados[3]);
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

  }, [sucursal, actualizacion]);

  // Excluir las ventas anuladas.
  const ventasValidas = ventas.filter(
    venta => venta.estado === 'EMITIDA'
  );

  // Obtener las ventas correspondientes al día actual.
  const hoy = fechaLocal();

  const ventasHoy = ventasValidas.filter(
    venta => fechaLocal(new Date(venta.fecha)) === hoy
  );

  // Calcular los indicadores.
  const totalVendido = ventasHoy.reduce(
    (total, venta) => total + Number(venta.total),
    0
  );

  const totalTransacciones = ventasHoy.length;

  const ticketPromedio = totalTransacciones > 0
    ? totalVendido / totalTransacciones
    : 0;

  const productosActivos = productos.filter(
    producto => producto.activo
  ).length;

  const alertas = existencias.filter(
    item =>
      Number(item.stock_actual) <= Number(item.stock_minimo)
  );

  // Agrupar las ventas por fecha.
  const datosGrafico = ultimosSieteDias().map(dia => ({
    ...dia,
    total: ventasValidas
      .filter(venta =>
        fechaLocal(new Date(venta.fecha)) === dia.fecha
      )
      .reduce(
        (total, venta) => total + Number(venta.total),
        0
      )
  }));

  // Ordenar las alertas, colocando primero los agotados.
  const alertasOrdenadas = [...alertas].sort((a, b) => {
    const proporcionA = Number(a.stock_minimo) > 0
      ? Number(a.stock_actual) / Number(a.stock_minimo)
      : 0;

    const proporcionB = Number(b.stock_minimo) > 0
      ? Number(b.stock_actual) / Number(b.stock_minimo)
      : 0;

    return proporcionA - proporcionB;
  });

  // Mostrar las cinco ventas más recientes del período.
  const ventasRecientes = [...ventasValidas]
    .sort((a, b) =>
      new Date(b.fecha) - new Date(a.fecha)
    )
    .slice(0, 5);

  const columnasVentas = [
    {
      campo: 'numero_documento',
      titulo: 'Documento',
      render: venta =>
        `${venta.tipo_documento} ${venta.numero_documento}`
    },
    {
      campo: 'sucursal_nombre',
      titulo: 'Sucursal'
    },
    {
      campo: 'fecha',
      titulo: 'Fecha',
      render: venta =>
        new Date(venta.fecha).toLocaleString('es-SV', {
          timeZone: ZONA_HORARIA,
          dateStyle: 'short',
          timeStyle: 'short'
        })
    },
    {
      campo: 'total',
      titulo: 'Total',
      render: venta =>
        formatoMoneda.format(Number(venta.total))
    }
  ];

  function mostrarValor(valor) {
    return cargando || error ? '—' : valor;
  }

  return (
    <div className="space-y-6">

      {/* Encabezado y filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">

        <div>
          <h1 className="text-3xl font-bold">
            Resumen general
          </h1>

          <p className="mt-1 text-sm text-oliva">
            Monitoreo de las operaciones del restaurante.
          </p>

          <p className="mt-2 text-sm text-oliva capitalize">
            {new Date().toLocaleDateString('es-SV', {
              dateStyle: 'full',
              timeZone: ZONA_HORARIA
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">

          <CampoFormulario
            id="sucursalResumen"
            etiqueta="Sucursal"
          >
            <select
              id="sucursalResumen"
              className="campo"
              value={sucursal}
              onChange={e => setSucursal(e.target.value)}
            >
              <option value="">
                Todas las sucursales
              </option>

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

          <button
            type="button"
            className="btn-claro flex items-center gap-2"
            disabled={cargando}
            onClick={() =>
              setActualizacion(valor => valor + 1)
            }
          >
            <RefreshCw
              size={16}
              className={cargando ? 'animate-spin' : ''}
            />

            Actualizar
          </button>

        </div>
      </div>

      {/* Mensajes de error */}
      {error && (
        <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Indicadores principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <TarjetaIndicador
          titulo="Ventas del día"
          valor={mostrarValor(
            formatoMoneda.format(totalVendido)
          )}
          descripcion="Ventas emitidas hoy, IVA incluido"
          icono={DollarSign}
          color="text-marino"
        />

        <TarjetaIndicador
          titulo="Transacciones"
          valor={mostrarValor(totalTransacciones)}
          descripcion="Ventas realizadas hoy"
          icono={Receipt}
          color="text-marino"
        />

        <TarjetaIndicador
          titulo="Productos activos"
          valor={mostrarValor(productosActivos)}
          descripcion="Catálogo general de productos"
          icono={Package}
          color="text-green-700"
        />

        <TarjetaIndicador
          titulo="Alertas de stock"
          valor={mostrarValor(alertas.length)}
          descripcion="Existencias en el mínimo o por debajo"
          icono={AlertTriangle}
          color="text-red-600"
        />

      </div>

      {cargando ? (
        <div className="py-12 text-center text-oliva">
          Cargando información del dashboard...
        </div>
      ) : !error && (
        <>

          {/* Gráfico e indicadores secundarios */}
          <div className="grid gap-4 xl:grid-cols-3">

            <div className="xl:col-span-2">
              <GraficoVentas datos={datosGrafico} />
            </div>

            <div className="space-y-4">

              <TarjetaIndicador
                titulo="Ticket promedio"
                valor={formatoMoneda.format(ticketPromedio)}
                descripcion="Importe promedio por venta de hoy"
                icono={TrendingUp}
              />

              <TarjetaIndicador
                titulo="Ventas de los últimos 7 días"
                valor={formatoMoneda.format(
                  datosGrafico.reduce(
                    (total, dia) => total + dia.total,
                    0
                  )
                )}
                descripcion="Total acumulado del período"
                icono={DollarSign}
              />

            </div>

          </div>

          {/* Alertas de inventario */}
          <section className="rounded-xl border border-oliva/30 p-5">

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

              <div>
                <h2 className="text-lg font-bold">
                  Alertas de inventario
                </h2>

                <p className="text-sm text-oliva">
                  Insumos que requieren atención.
                </p>
              </div>

              <Link
                to="/inventario"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                Ver inventario
                <ArrowRight size={16} />
              </Link>

            </div>

            {alertasOrdenadas.length === 0 ? (
              <p className="rounded-lg bg-green-100 p-4 text-sm text-green-700">
                No hay alertas de stock mínimo.
              </p>
            ) : (
              <div className="space-y-2">

                {alertasOrdenadas.slice(0, 5).map(item => (
                  <div
                    key={`${item.id_sucursal}-${item.id_insumo}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 border-red-500 bg-red-50 p-3"
                  >

                    <div className="flex items-center gap-3">

                      <AlertTriangle
                        size={20}
                        className="text-red-600"
                      />

                      <div>
                        <p className="font-semibold">
                          {item.insumo}
                        </p>

                        <p className="text-xs text-oliva">
                          {item.sucursal}
                        </p>
                      </div>

                    </div>

                    <div className="text-sm text-red-700">
                      Disponible: {Number(item.stock_actual)}
                      {' / '}
                      Mínimo: {Number(item.stock_minimo)}
                      {' '}
                      {item.abreviatura}
                    </div>

                  </div>
                ))}

                {alertasOrdenadas.length > 5 && (
                  <p className="text-sm text-oliva">
                    Y {alertasOrdenadas.length - 5} alertas adicionales.
                  </p>
                )}

              </div>
            )}

          </section>

          {/* Ventas recientes */}
          <section className="space-y-4">

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Ventas recientes
              </h2>

              <Link
                to="/ventas"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                Ver ventas
                <ArrowRight size={16} />
              </Link>
            </div>

            <Tabla
              columnas={columnasVentas}
              datos={ventasRecientes}
              clave="id_venta"
              mensajeVacio="No hay ventas registradas durante los últimos siete días."
            />

          </section>

        </>
      )}

      {/* Accesos rápidos */}
      <section>

        <h2 className="mb-3 text-lg font-bold">
          Accesos rápidos
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">

          <Link
            to="/inventario"
            className="flex items-center gap-3 rounded-xl border border-oliva/30 p-4 transition-colors hover:bg-oliva/10"
          >
            <Package size={24} />

            <div className="flex-1">
              <p className="font-semibold">
                Gestionar inventario
              </p>

              <p className="text-sm text-oliva">
                Productos, recetas y existencias.
              </p>
            </div>

            <ArrowRight size={18} />
          </Link>

          <Link
            to="/catalogo"
            className="flex items-center gap-3 rounded-xl border border-oliva/30 p-4 transition-colors hover:bg-oliva/10"
          >
            <ShoppingCart size={24} />

            <div className="flex-1">
              <p className="font-semibold">
                Ir al catálogo
              </p>

              <p className="text-sm text-oliva">
                Registrar un nuevo pedido.
              </p>
            </div>

            <ArrowRight size={18} />
          </Link>

        </div>

      </section>

    </div>
  );
}
