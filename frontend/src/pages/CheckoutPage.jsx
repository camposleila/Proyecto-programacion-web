import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useCarrito } from '../context/CarritoContext';
import { listarSucursales } from '../services/catalogosService';
import { obtenerTurnoActual } from '../services/turnosService';
import { crearCliente } from '../services/clientesService';
import { crearVenta } from '../services/ventasService';
import { getUsuario } from '../utils/sesion';
import { calcularTotales, moneda, porcentajeADolares, r2 } from '../utils/dinero';
import { ROLES_CON_DESCUENTO, TIPOS_DOCUMENTO } from '../utils/constantes';
import { duiValido, emailValido, nitValido, nrcValido } from '../utils/formatos';
import PanelCarrito from '../components/pos/PanelCarrito.jsx';
import FormularioCliente, { CLIENTE_VACIO } from '../components/checkout/FormularioCliente.jsx';
import PanelPagos from '../components/checkout/PanelPagos.jsx';
import ModalMetodoPago from '../components/checkout/ModalMetodoPago.jsx';
import ModalExito from '../components/checkout/ModalExito.jsx';
import PantallaCarga from '../components/ui/PantallaCarga.jsx';

let contadorPagos = 0;
const nuevoUid = () => `pago-${++contadorPagos}`;

export default function CheckoutPage() {
  const navegar = useNavigate();
  const { items, nota, vaciar } = useCarrito();
  const usuario = useMemo(() => getUsuario(), []);
  const puedeDescontar = ROLES_CON_DESCUENTO.includes(usuario.rol);

  const [sucursales, setSucursales] = useState([]);
  const [idSucursal, setIdSucursal] = useState('');
  const [turnoCaja, setTurnoCaja] = useState(null);
  const [idTurno, setIdTurno] = useState(null);
  const [cargandoTurno, setCargandoTurno] = useState(true);
  const [tipo, setTipo] = useState('FACTURA');
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [errores, setErrores] = useState({});
  const [pagos, setPagos] = useState([]);
  const [porcentaje, setPorcentaje] = useState('');
  const [modalPago, setModalPago] = useState({ abierto: false, editando: null });
  const [procesando, setProcesando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [factura, setFactura] = useState(null);
  const [vueltoFinal, setVueltoFinal] = useState(0);

  // Sucursales (la del usuario queda preseleccionada si la sesión la trae)
  useEffect(() => {
    let vivo = true;
    const cargarDatosCaja = async () => {
      try {
        const [resultadoSucursales, resultadoTurno] = await Promise.allSettled([
          listarSucursales(),
          obtenerTurnoActual()
        ]);
        if (!vivo) return;

        if (resultadoSucursales.status === 'rejected') {
          setSucursales([]);
          setIdSucursal('');
          setTurnoCaja(null);
          setIdTurno(null);
          setErrorGeneral(`No se pudieron cargar las sucursales: ${resultadoSucursales.reason.message}`);
          return;
        }

        const lista = resultadoSucursales.value;
        setSucursales(lista);
        const sucursalPropia = lista.find(
          (s) => Number(s.id_sucursal) === Number(usuario.id_sucursal)
        );
        const sucursalInicial = sucursalPropia || lista[0];
        setIdSucursal(String(sucursalInicial?.id_sucursal ?? ''));

        if (resultadoTurno.status === 'rejected') {
          setTurnoCaja(null);
          setIdTurno(null);
          setErrorGeneral(`No se pudo verificar el turno de caja: ${resultadoTurno.reason.message}`);
          return;
        }

        const turno = resultadoTurno.value;
        if (!turno) {
          setTurnoCaja(null);
          setIdTurno(null);
          setErrorGeneral('No tienes un turno de caja abierto. Abre tu turno antes de cobrar.');
          return;
        }

        const sucursalTurno = lista.find(
          (s) => Number(s.id_sucursal) === Number(turno.id_sucursal)
        );
        if (!sucursalTurno) {
          setTurnoCaja(null);
          setIdTurno(null);
          setErrorGeneral('No se encontró la sucursal del turno abierto.');
          return;
        }

        setTurnoCaja(turno);
        setIdTurno(Number(turno.id_turno));
        setIdSucursal(String(sucursalTurno.id_sucursal));
        setErrorGeneral('');
      } finally {
        if (vivo) setCargandoTurno(false);
      }
    };

    cargarDatosCaja();
    return () => { vivo = false; };
  }, [usuario.id_sucursal]);

  // Totales (con descuento convertido a dólares, como pide el contrato)
  const sumaLineas = useMemo(() => calcularTotales(items, 0).suma_lineas, [items]);
  const descuentoUSD = puedeDescontar ? porcentajeADolares(porcentaje, sumaLineas) : 0;
  const totales = useMemo(() => calcularTotales(items, descuentoUSD), [items, descuentoUSD]);

  const registrado = r2(pagos.reduce((a, p) => a + p.monto, 0));
  const diferencia = r2(totales.total - registrado);
  const tieneProductosDemo = items.some((item) => item.solo_demo);
  // Lo máximo que admite el método que se está agregando/editando (nunca más de lo pendiente)
  const maximoPago = Math.max(0, r2(diferencia + (modalPago.editando?.monto || 0)));
  const vueltoTotal = r2(pagos.reduce((a, p) => a + (p.vuelto || 0), 0));
  const puedeProcesar = items.length > 0 && !tieneProductosDemo && Boolean(idTurno) &&
    totales.total > 0 && diferencia === 0 && !procesando;

  // ── Pagos ──
  const guardarPago = (pago) => {
    setPagos((prev) =>
      modalPago.editando
        ? prev.map((p) => (p.uid === modalPago.editando.uid ? { ...p, ...pago } : p))
        : [...prev, { uid: nuevoUid(), ...pago }]
    );
    setModalPago({ abierto: false, editando: null });
  };

  // ── Validación ──
  const validar = () => {
    const e = {};
    const c = cliente;
    if (c.email && !emailValido(c.email)) e.email = 'Correo no válido';
    if (tipo === 'FACTURA') {
      if (c.tipo_identificacion === 'nit' && c.nit && !nitValido(c.nit)) e.nit = 'El NIT debe tener 14 dígitos';
      if (c.tipo_identificacion !== 'nit' && c.dui && !duiValido(c.dui)) e.dui = 'El DUI debe tener 9 dígitos';
      const hayDatosPerfil = c.nombre.trim() || c.dui || c.nit || c.email;
      if (hayDatosPerfil && !c.nombre.trim()) e.nombre = 'Escribe el nombre para crear el perfil';
    } else {
      if (!c.nombre.trim()) e.nombre = 'Obligatorio en crédito fiscal';
      if (!nitValido(c.nit)) e.nit = 'El NIT debe tener 14 dígitos';
      if (c.dui && !duiValido(c.dui)) e.dui = 'El DUI debe tener 9 dígitos';
      if (!nrcValido(c.nrc)) e.nrc = 'NRC no válido (6 a 8 dígitos)';
      if (!c.giro.trim()) e.giro = 'Obligatorio en crédito fiscal';
      if (!c.direccion.trim()) e.direccion = 'Obligatoria en crédito fiscal';
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  // ── Procesar pago ──
  const procesar = async () => {
    setErrorGeneral('');
    if (!idTurno) return setErrorGeneral('Necesitas un turno de caja abierto para registrar la venta.');
    if (tieneProductosDemo) {
      return setErrorGeneral('El carrito contiene productos de demostración. Cárgalos en la base de datos antes de cobrar.');
    }
    if (!idSucursal) return setErrorGeneral('Selecciona una sucursal.');
    if (!validar()) return setErrorGeneral('Revisa los datos del cliente marcados en rojo.');

    setProcesando(true);
    try {
      // 1) Cliente: usa el existente, o crea uno nuevo si hay datos
      let idCliente = cliente.id_cliente !== '' && !isNaN(cliente.id_cliente) ? Number(cliente.id_cliente) : null;
      const hayDatos = cliente.nombre.trim() || cliente.dui || cliente.nit || cliente.email;
      if (!idCliente && (tipo === 'CCF' || hayDatos)) {
        const esCCF = tipo === 'CCF';
        const nuevo = await crearCliente({
          nombre: cliente.nombre.trim() || 'Consumidor final',
          dui: cliente.dui || null,
          email: cliente.email.trim() || null,
          nit: cliente.nit || null,
          nrc: esCCF ? cliente.nrc : null,
          giro: esCCF ? cliente.giro.trim() : null,
          direccion: esCCF ? cliente.direccion.trim() : null,
          es_contribuyente: esCCF
        });
        idCliente = nuevo.id_cliente ?? nuevo.id;
        setCliente((c) => ({ ...c, id_cliente: idCliente })); // si la venta falla, el reintento no duplica el cliente
      }

      // 2) Venta (contrato: POST /api/ventas)
      const payload = {
        tipo_documento: tipo,
        id_cliente: idCliente,
        id_sucursal: Number(idSucursal),
        id_turno: idTurno,
        ...(descuentoUSD > 0 ? { descuento: descuentoUSD } : {}),
        ...(nota.trim() ? { nota: nota.trim() } : {}),
        items: items.map((i) => ({ id_producto: i.id_producto, cantidad: i.cantidad })),
        pagos: pagos.map((p) => ({
          metodo_pago: p.metodo_pago,
          monto: p.monto,
          ...(p.referencia ? { referencia: p.referencia } : {})
        }))
      };
      const respuesta = await crearVenta(payload, {
        cliente: { ...cliente, id_cliente: idCliente },
        items,
        sucursal: sucursales.find((s) => Number(s.id_sucursal) === Number(idSucursal))?.nombre,
        empleado: usuario.nombre
      });
      setVueltoFinal(vueltoTotal);
      setFactura(respuesta);
    } catch (e) {
      setErrorGeneral(e.message || 'No se pudo procesar el pago.');
    } finally {
      setProcesando(false);
    }
  };

  const nuevaVenta = () => {
    vaciar();
    setFactura(null);
    setVueltoFinal(0);
    navegar('/catalogo', { replace: true });
  };

  // Sin productos (y sin venta recién hecha) no hay nada que cobrar
  if (items.length === 0 && !factura) return <Navigate to="/catalogo" replace />;

  return (
    <div>
      <h1 className="mb-4 text-center text-3xl font-bold">Checkout</h1>

      {errorGeneral && (
        <div role="alert" className="mx-auto mb-4 flex max-w-3xl items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" /> <span>{errorGeneral}</span>
        </div>
      )}
      {tieneProductosDemo && (
        <div role="status" className="mx-auto mb-4 max-w-3xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Este carrito usa productos de demostración y no se puede cobrar hasta registrarlos en la base de datos.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr_300px]">
        {/* ── Resumen de orden ── */}
        <PanelCarrito
          titulo="Resumen de orden"
          totales={totales}
          porcentajeDescuento={porcentaje ? Number(porcentaje) : 0}
          className="min-h-[560px]"
        />

        {/* ── Datos de facturación ── */}
        <section className="rounded-2xl border border-marino bg-crema p-5">
          <h2 className="text-2xl font-bold">Datos de facturación</h2>
          <p className="text-sm font-bold">Empleado: {usuario.codigo}</p>

          <label className="etiqueta mt-3 text-oliva" htmlFor="sucursal">Selección de sucursal</label>
          <select
            id="sucursal"
            value={idSucursal}
            onChange={(e) => setIdSucursal(e.target.value)}
            disabled={cargandoTurno || Boolean(turnoCaja)}
            className="w-full max-w-[250px] rounded-xl bg-marino px-4 py-2 text-sm font-semibold text-crema focus:outline-none focus:ring-2 focus:ring-celeste"
          >
            {!turnoCaja && <option value="">{cargandoTurno ? 'Verificando turno…' : 'Sin turno abierto'}</option>}
            {sucursales.map((s) => <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>)}
          </select>
          {!turnoCaja && !cargandoTurno && (
            <p className="mt-1 text-xs text-oliva">
              Puedes elegir la sucursal, pero necesitas abrir un turno para registrar el cobro.
            </p>
          )}
          {turnoCaja && (
            <p className="mt-2 text-xs text-oliva">
              Turno #{idTurno} abierto · {turnoCaja.nombre_caja || 'Caja asignada'}
            </p>
          )}

          <p className="mb-1 mt-3 text-sm text-oliva">Tipo de documento</p>
          <div className="mb-4 flex gap-3">
            {Object.values(TIPOS_DOCUMENTO).map((t) => (
              <button
                key={t.valor}
                type="button"
                onClick={() => { setTipo(t.valor); setErrores({}); }}
                className={`rounded-xl border px-5 py-1.5 text-sm font-bold transition ${
                  tipo === t.valor ? 'border-marino bg-marino text-crema' : 'border-marino bg-crema hover:bg-celeste/40'
                }`}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>

          <FormularioCliente tipo={tipo} cliente={cliente} onChange={setCliente} errores={errores} />
        </section>

        {/* ── Método de pago ── */}
        <section className="flex flex-col rounded-2xl border border-marino bg-crema p-5">
          <h2 className="mb-4 text-2xl font-bold">Método de pago</h2>

          <PanelPagos
            pagos={pagos}
            onAgregar={() => setModalPago({ abierto: true, editando: null })}
            onEditar={(p) => setModalPago({ abierto: true, editando: p })}
            onQuitar={(uid) => setPagos((prev) => prev.filter((p) => p.uid !== uid))}
          />

          <div className="mt-auto pt-6">
            {puedeDescontar && (
              <div className="mb-3 flex items-center justify-between gap-2 text-sm">
                <label htmlFor="descuento" className="font-semibold">Descuento (%)</label>
                <input
                  id="descuento"
                  type="number" min="0" max="100" step="1"
                  value={porcentaje}
                  onChange={(e) => setPorcentaje(e.target.value)}
                  placeholder="0"
                  className="campo w-20 py-1 text-right"
                />
              </div>
            )}
            <div className="space-y-0.5 border-t border-marino pt-2 text-sm font-semibold">
              <div className="flex justify-between"><span>Total de la orden</span><span>{moneda(totales.total)}</span></div>
              <div className="flex justify-between"><span>Total registrado</span><span>{moneda(registrado)}</span></div>
              <div className="flex justify-between">
                <span>Diferencia</span>
                <span className={diferencia !== 0 ? 'text-red-600' : ''}>{diferencia === 0 ? '$0.0' : moneda(diferencia)}</span>
              </div>
            </div>
            <button
              onClick={procesar}
              disabled={!puedeProcesar}
              className="mt-3 w-full rounded-full bg-rosa py-2.5 text-lg font-bold text-marino transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-rosa/40 disabled:text-marino/60"
            >
              Procesar pago
            </button>
          </div>
        </section>
      </div>

      <ModalMetodoPago
        abierto={modalPago.abierto}
        editando={modalPago.editando}
        maximo={maximoPago}
        usados={pagos.map((p) => p.metodo_pago)}
        onCerrar={() => setModalPago({ abierto: false, editando: null })}
        onGuardar={guardarPago}
      />

      <PantallaCarga visible={procesando} />
      <ModalExito factura={factura} vuelto={vueltoFinal} onNuevaVenta={nuevaVenta} />
    </div>
  );
}
