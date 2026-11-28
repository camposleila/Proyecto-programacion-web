
import { useEffect, useState } from 'react';
import {
    Search,
    RefreshCw,
    AlertTriangle
} from 'lucide-react';

import Tabla from '../ui/Tabla.jsx';
import Paginacion from '../ui/Paginacion.jsx';
import CampoFormulario from '../ui/CampoFormulario.jsx';

import { listarExistencias } from '../../services/inventarioService';
import { listarSucursales } from '../../services/catalogosService';

const REGISTROS_POR_PAGINA = 10;


function estaAgotado(insumo) {
    return Number(insumo.stock_actual) <= 0;
}

function tieneStockBajo(insumo) {
    return (
        Number(insumo.stock_actual) > 0 &&
        Number(insumo.stock_actual) <= Number(insumo.stock_minimo)
    );
}

function estaDisponible(insumo) {
    return (
        Number(insumo.stock_actual) > 0 &&
        Number(insumo.stock_actual) > Number(insumo.stock_minimo)
    );
}

function requiereAlerta(insumo) {
    return estaAgotado(insumo) || tieneStockBajo(insumo);
}


function formatearCantidad(cantidad) {
    return Number(cantidad).toLocaleString('en-US', {
        maximumFractionDigits: 3
    });
}

export default function TablaExistencias() {

    const [existencias, setExistencias] = useState([]);
    const [sucursales, setSucursales] = useState([]);

    const [sucursal, setSucursal] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [soloAlertas, setSoloAlertas] = useState(false);
    const [pagina, setPagina] = useState(1);

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [actualizacion, setActualizacion] = useState(0);

    // Cargar sucursales y existencias.
    useEffect(() => {
        let vigente = true;

        async function cargarDatos() {
            try {
                setCargando(true);
                setError('');

                const [stock, listaSucursales] = await Promise.all([
                    listarExistencias(sucursal),
                    listarSucursales()
                ]);

                if (!Array.isArray(stock)) {
                    throw new Error('Formato de existencias no válido.');
                }

                if (vigente) {
                    setExistencias(stock.map(item => ({
                        ...item,
                        clave: `${item.id_sucursal}-${item.id_insumo}`
                    })));

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

    }, [sucursal, actualizacion]);

    // Aplicar filtros.
    const existenciasFiltradas = existencias.filter(item => {

        const coincideBusqueda =
            `${item.insumo} ${item.sucursal}`
                .toLowerCase()
                .includes(busqueda.toLowerCase().trim());

        const coincideAlerta =
            !soloAlertas || requiereAlerta(item);

        return coincideBusqueda && coincideAlerta;
    });

    // Calcular indicadores.
    const totalDisponibles =
        existencias.filter(estaDisponible).length;

    const totalStockBajo =
        existencias.filter(tieneStockBajo).length;

    const totalAgotados =
        existencias.filter(estaAgotado).length;

    // Aplicar paginación.
    const inicio = (pagina - 1) * REGISTROS_POR_PAGINA;

    const existenciasPagina = existenciasFiltradas.slice(
        inicio,
        inicio + REGISTROS_POR_PAGINA
    );

    // Definir columnas de la tabla.
    const columnas = [
        {
            campo: 'insumo',
            titulo: 'Insumo'
        },
        {
            campo: 'sucursal',
            titulo: 'Sucursal'
        },
        {
            campo: 'stock_actual',
            titulo: 'Existencia',
            render: item => (
                <span className="font-semibold">
                    {formatearCantidad(item.stock_actual)} {item.abreviatura}
                </span>
            )
        },
        {
            campo: 'stock_minimo',
            titulo: 'Stock mínimo',
            render: item =>
                `${formatearCantidad(item.stock_minimo)} ${item.abreviatura}`
        },
        {
            campo: 'estado',
            titulo: 'Estado',
            render: item => {

                if (estaAgotado(item)) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-200 px-3 py-1 text-xs font-semibold text-red-800">
                            <AlertTriangle size={14} />
                            Agotado
                        </span>
                    );
                }

                if (tieneStockBajo(item)) {
                    return (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle size={14} />
                            Stock bajo
                        </span>
                    );
                }

                return (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                        Disponible
                    </span>
                );
            }
        }
    ];

    return (
        <section className="space-y-4">

            {/* Encabezado */}
            <div>
                <h2 className="text-xl font-bold">
                    Existencias por sucursal
                </h2>

                <p className="mt-1 text-sm text-oliva">
                    Consultá las cantidades disponibles y las alertas de inventario.
                </p>
            </div>

            {/* Indicadores */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

                <div className="rounded-xl border border-oliva/30 p-4">
                    <p className="text-sm text-oliva">
                        Total de registros
                    </p>

                    <p className="mt-2 text-3xl font-bold">
                        {cargando || error ? '—' : existencias.length}
                    </p>
                </div>

                <div className="rounded-xl border border-green-200 p-4">
                    <p className="text-sm text-oliva">
                        Stock disponible
                    </p>

                    <p className="mt-2 text-3xl font-bold text-green-700">
                        {cargando || error ? '—' : totalDisponibles}
                    </p>
                </div>

                <div className="rounded-xl border border-amber-200 p-4">
                    <p className="text-sm text-oliva">
                        Stock bajo
                    </p>

                    <p className="mt-2 text-3xl font-bold text-amber-600">
                        {cargando || error ? '—' : totalStockBajo}
                    </p>
                </div>

                <div className="rounded-xl border border-red-200 p-4">
                    <p className="text-sm text-oliva">
                        Stock agotado
                    </p>

                    <p className="mt-2 text-3xl font-bold text-red-700">
                        {cargando || error ? '—' : totalAgotados}
                    </p>
                </div>

            </div>


            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3">

                <div className="min-w-[220px]">

                    <CampoFormulario
                        id="sucursal"
                        etiqueta="Sucursal"
                    >
                        <select
                            id="sucursal"
                            className="campo"
                            value={sucursal}
                            onChange={e => {
                                setSucursal(e.target.value);
                                setPagina(1);
                            }}
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

                </div>

                <div className="min-w-[220px] flex-1">

                    <CampoFormulario
                        id="buscarInsumo"
                        etiqueta="Buscar insumo"
                    >
                        <div className="relative">

                            <Search
                                size={18}
                                className="absolute left-3 top-3 text-oliva"
                            />

                            <input
                                id="buscarInsumo"
                                type="text"
                                className="campo pl-10"
                                placeholder="Nombre del insumo..."
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

            {/* Filtro de alertas */}
            <label className="flex cursor-pointer items-center gap-2 text-sm">

                <input
                    type="checkbox"
                    className="h-4 w-4 accent-marino"
                    checked={soloAlertas}
                    onChange={e => {
                        setSoloAlertas(e.target.checked);
                        setPagina(1);
                    }}
                />

                Mostrar solo alertas de stock mínimo

            </label>

            {/* Resultados */}
            {error ? (
                <div className="rounded-xl bg-red-100 p-4 text-sm text-red-700">
                    {error}
                </div>
            ) : cargando ? (
                <div className="py-10 text-center text-oliva">
                    Cargando existencias...
                </div>
            ) : (
                <>

                    <Tabla
                        columnas={columnas}
                        datos={existenciasPagina}
                        clave="clave"
                        mensajeVacio="No se encontraron existencias."
                        claseFila={item =>
                            requiereAlerta(item)
                                ? 'bg-red-50 text-red-800'
                                : ''
                        }
                    />

                    <Paginacion
                        pagina={pagina}
                        totalRegistros={existenciasFiltradas.length}
                        registrosPorPagina={REGISTROS_POR_PAGINA}
                        onCambiarPagina={setPagina}
                    />

                </>
            )}

        </section>
    );
}
