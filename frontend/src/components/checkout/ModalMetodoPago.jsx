import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Bitcoin, Wallet } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import { CamposBitcoin, CamposChivo, CamposEfectivo, CamposTarjeta } from './metodos/Campos.jsx';
import { METODOS_PAGO } from '../../utils/constantes';
import { moneda, r2 } from '../../utils/dinero';
import { MARCAS, calcularEfectivo, validarBitcoin, validarChivo, validarTarjeta } from '../../utils/validacionesPago';

const ICONOS = { Banknote, CreditCard, Bitcoin, Wallet };

const VACIO = {
  recibido: '',
  tipoTarjeta: 'CREDITO', numero: '', titular: '', exp: '', autorizacion: '',
  red: 'ONCHAIN', txid: '', montoBtc: '',
  telefono: '', titularChivo: '', idTransaccion: '',
  confirmado: false
};

// Mini ventana: elegir método → completar SUS datos → monto → agregar.
//  maximo  = lo que aún falta por cobrar (ningún método puede superarlo)
//  Solo EFECTIVO admite recibir más (el exceso es vuelto).
export default function ModalMetodoPago({ abierto, onCerrar, onGuardar, maximo, editando, usados }) {
  const [metodo, setMetodo] = useState(null);
  const [monto, setMonto] = useState('');
  const [d, setD] = useState(VACIO);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    if (!abierto) return;
    setErrores({});
    if (editando) {
      setMetodo(editando.metodo_pago);
      setMonto(String(editando.monto));
      setD({ ...VACIO, ...editando.datos });
    } else {
      const libre = METODOS_PAGO.find((m) => !usados.includes(m.valor));
      setMetodo(libre?.valor || null);
      setMonto(maximo > 0 ? maximo.toFixed(2) : '');
      setD(VACIO);
    }
  }, [abierto, editando]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (campo, valor) => {
    setD((prev) => ({ ...prev, [campo]: valor }));
    setErrores((prev) => ({ ...prev, [campo]: undefined }));
  };

  const elegirMetodo = (valor) => {
    setMetodo(valor);
    setErrores({});
    setD((prev) => ({ ...prev, confirmado: false }));
  };

  const guardar = () => {
    const valor = r2(monto);
    let e = {};
    if (!metodo) return setErrores({ monto: 'Elige un método de pago.' });

    if (!(valor > 0)) e.monto = 'El monto debe ser mayor a 0';
    else if (valor > r2(maximo) + 0.001) {
      e.monto = metodo === 'EFECTIVO'
        ? `El monto a cobrar no puede superar lo pendiente (${moneda(maximo)}). Lo que sobre se entrega como vuelto.`
        : `No puede superar lo pendiente (${moneda(maximo)}): solo en efectivo se puede recibir de más.`;
    }

    let referencia = null;
    let extra = {};
    let datos = d;

    if (metodo === 'EFECTIVO') {
      const n = d.recibido === '' ? null : Number(d.recibido);
      if (n !== null && (Number.isNaN(n) || n < 0)) e.recibido = 'Monto recibido no válido';
      else if (valor > 0) {
        const c = calcularEfectivo(valor, d.recibido);
        if (c.faltante > 0) e.recibido = `El efectivo recibido no alcanza (faltan ${moneda(c.faltante)})`;
        else {
          extra = { recibido: c.recibido, vuelto: c.vuelto };
          referencia = c.vuelto > 0 ? `Recibido ${moneda(c.recibido)} · Vuelto ${moneda(c.vuelto)}` : null;
        }
      }
    } else if (metodo === 'TARJETA') {
      const r = validarTarjeta(d);
      e = { ...e, ...r.errores };
      referencia = `${MARCAS[r.marca]?.nombre || 'Tarjeta'} ${d.tipoTarjeta === 'DEBITO' ? 'débito' : 'crédito'} ****${r.ultimos4} · ${d.autorizacion.trim()}`;
      datos = { ...d, numero: '' }; // el número completo no se conserva
    } else if (metodo === 'BITCOIN') {
      e = { ...e, ...validarBitcoin(d).errores };
      referencia = `${d.red === 'LIGHTNING' ? 'Lightning' : 'On-chain'} ${d.txid.trim()} · ${d.montoBtc} BTC`;
    } else if (metodo === 'CHIVO') {
      e = { ...e, ...validarChivo(d).errores };
      referencia = `Chivo ${d.telefono} · ${d.idTransaccion.trim()}`;
    }

    const hayErrores = Object.values(e).some(Boolean);
    setErrores(e);
    if (hayErrores) return;
    onGuardar({ metodo_pago: metodo, monto: valor, referencia, datos, ...extra });
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} ancho="max-w-lg" titulo={editando ? 'Editar método de pago' : 'Agregar método de pago'}>
      <p className="mb-2 text-sm font-medium">Método</p>
      <div className="grid grid-cols-2 gap-2">
        {METODOS_PAGO.map((m) => {
          const Icono = ICONOS[m.icono];
          const bloqueado = usados.includes(m.valor) && m.valor !== editando?.metodo_pago;
          return (
            <button key={m.valor} type="button" disabled={bloqueado} onClick={() => elegirMetodo(m.valor)}
              title={bloqueado ? 'Ya está en la lista; edítalo desde ahí' : undefined}
              className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                metodo === m.valor ? 'border-marino bg-celeste' : 'border-oliva/40 bg-crema hover:bg-oliva/10'
              } disabled:cursor-not-allowed disabled:opacity-40`}>
              <Icono size={18} /> {m.etiqueta}
            </button>
          );
        })}
      </div>

      <label className="etiqueta mt-4" htmlFor="monto-pago">
        {metodo === 'EFECTIVO' ? 'Monto a cobrar en efectivo (USD)' : 'Monto a pagar con este método (USD)'}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-oliva">$</span>
        <input id="monto-pago" type="number" inputMode="decimal" min="0" step="0.01" value={monto}
          onChange={(ev) => { setMonto(ev.target.value); setErrores((p) => ({ ...p, monto: undefined })); }}
          className={`campo pl-7 ${errores.monto ? 'campo-error' : ''}`} />
      </div>
      {errores.monto
        ? <p className="mt-1 text-xs text-red-600">{errores.monto}</p>
        : <p className="mt-1 text-xs text-oliva">Pendiente por cobrar: {moneda(maximo)}</p>}

      <div className="mt-4 border-t border-oliva/30 pt-4">
        {metodo === 'EFECTIVO' && <CamposEfectivo d={d} set={set} errores={errores} monto={r2(monto)} />}
        {metodo === 'TARJETA' && <CamposTarjeta d={d} set={set} errores={errores} />}
        {metodo === 'BITCOIN' && <CamposBitcoin d={d} set={set} errores={errores} monto={r2(monto)} />}
        {metodo === 'CHIVO' && <CamposChivo d={d} set={set} errores={errores} />}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onCerrar} className="btn-claro">Cancelar</button>
        <button onClick={guardar} className="btn-oscuro">{editando ? 'Guardar' : 'Agregar'}</button>
      </div>
    </Modal>
  );
}
