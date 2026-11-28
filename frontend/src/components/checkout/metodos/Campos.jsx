import { MARCAS, detectarMarca, formatearTarjeta, formatearTelefono, formatearVencimiento, calcularEfectivo } from '../../../utils/validacionesPago';
import { moneda } from '../../../utils/dinero';

// Campo con etiqueta + mensaje de error
export function Campo({ id, etiqueta, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">{etiqueta}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const cls = (error) => `campo ${error ? 'campo-error' : ''}`;

const Confirmacion = ({ d, set, errores, texto }) => (
  <div>
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" checked={d.confirmado} onChange={(e) => set('confirmado', e.target.checked)} className="mt-0.5 h-4 w-4 accent-marino" />
      <span>{texto}</span>
    </label>
    {errores.confirmado && <p className="mt-1 text-xs text-red-600">{errores.confirmado}</p>}
  </div>
);

// ───────────── EFECTIVO: el único método que admite vuelto ─────────────
const BILLETES = [5, 10, 20, 50, 100];

export function CamposEfectivo({ d, set, errores, monto }) {
  const { vuelto, faltante, recibido } = calcularEfectivo(monto || 0, d.recibido);
  return (
    <div className="space-y-3">
      <Campo id="recibido" etiqueta="Efectivo recibido del cliente (USD)" error={errores.recibido}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-oliva">$</span>
          <input id="recibido" type="number" inputMode="decimal" min="0" step="0.01" className={`${cls(errores.recibido)} pl-7`}
            placeholder="Vacío = pago exacto" value={d.recibido} onChange={(e) => set('recibido', e.target.value)} />
        </div>
      </Campo>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => set('recibido', '')} className="rounded-lg border border-marino px-2.5 py-1 text-xs font-semibold hover:bg-celeste/40">Exacto</button>
        {BILLETES.map((b) => (
          <button key={b} type="button" onClick={() => set('recibido', String(b))} className="rounded-lg border border-oliva/50 px-2.5 py-1 text-xs font-semibold hover:bg-celeste/40">${b}</button>
        ))}
      </div>
      {faltante > 0 ? (
        <p className="rounded-xl border border-red-600 px-3 py-2 text-sm font-semibold text-red-600">Faltan {moneda(faltante)} para cubrir este monto</p>
      ) : (
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${vuelto > 0 ? 'bg-celeste' : 'bg-oliva/10'}`}>
          <span className="text-sm font-semibold">{vuelto > 0 ? 'Vuelto a entregar' : 'Sin vuelto (pago exacto)'}</span>
          <span className="text-2xl font-bold">{moneda(vuelto)}</span>
        </div>
      )}
      <p className="text-xs text-oliva">Recibido: {moneda(recibido)}. Solo el efectivo admite vuelto; los demás métodos no pueden superar el monto pendiente.</p>
    </div>
  );
}

// ───────────── TARJETA ─────────────
export function CamposTarjeta({ d, set, errores }) {
  const marca = detectarMarca(d.numero);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[['CREDITO', 'Crédito'], ['DEBITO', 'Débito']].map(([v, t]) => (
          <button key={v} type="button" onClick={() => set('tipoTarjeta', v)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${d.tipoTarjeta === v ? 'border-marino bg-marino text-crema' : 'border-oliva/50 bg-crema hover:bg-oliva/10'}`}>{t}</button>
        ))}
      </div>

      <Campo id="numero" etiqueta="Número de tarjeta" error={errores.numero}>
        <div className="relative">
          <input id="numero" inputMode="numeric" autoComplete="off" className={`${cls(errores.numero)} pr-32 font-mono tracking-wider`}
            placeholder="0000 0000 0000 0000" value={d.numero} onChange={(e) => set('numero', formatearTarjeta(e.target.value))} />
          <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs font-bold ${marca ? 'bg-celeste' : 'bg-oliva/10 text-oliva'}`}>
            {marca ? MARCAS[marca].nombre : 'Marca'}
          </span>
        </div>
      </Campo>

      <Campo id="titular" etiqueta="Nombre del titular" error={errores.titular}>
        <input id="titular" autoComplete="off" className={`${cls(errores.titular)} uppercase`} placeholder="COMO APARECE EN LA TARJETA"
          value={d.titular} onChange={(e) => set('titular', e.target.value)} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo id="exp" etiqueta="Vencimiento (MM/AA)" error={errores.exp}>
          <input id="exp" inputMode="numeric" autoComplete="off" className={cls(errores.exp)} placeholder="MM/AA"
            value={d.exp} onChange={(e) => set('exp', formatearVencimiento(e.target.value))} />
        </Campo>
        <Campo id="autorizacion" etiqueta="Autorización / voucher" error={errores.autorizacion}>
          <input id="autorizacion" autoComplete="off" className={cls(errores.autorizacion)} placeholder="Ej. VOUCHER-123"
            value={d.autorizacion} onChange={(e) => set('autorizacion', e.target.value.toUpperCase())} />
        </Campo>
      </div>
      <p className="text-xs text-oliva">Por seguridad solo se guardan la marca, los últimos 4 dígitos y el voucher; el número completo nunca se envía.</p>
    </div>
  );
}

// ───────────── BITCOIN ─────────────
export function CamposBitcoin({ d, set, errores, monto }) {
  const btc = Number(d.montoBtc);
  const tasa = btc > 0 && monto > 0 ? monto / btc : null;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[['ONCHAIN', 'On-chain'], ['LIGHTNING', 'Lightning']].map(([v, t]) => (
          <button key={v} type="button" onClick={() => { set('red', v); set('txid', ''); }}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${d.red === v ? 'border-marino bg-marino text-crema' : 'border-oliva/50 bg-crema hover:bg-oliva/10'}`}>{t}</button>
        ))}
      </div>
      <Campo id="txid" etiqueta={d.red === 'LIGHTNING' ? 'Hash del pago o factura Lightning' : 'ID de la transacción (TXID)'} error={errores.txid}>
        <input id="txid" autoComplete="off" spellCheck={false} className={`${cls(errores.txid)} font-mono text-xs`}
          placeholder={d.red === 'LIGHTNING' ? 'lnbc… o hash de 64 caracteres' : '64 caracteres hexadecimales'}
          value={d.txid} onChange={(e) => set('txid', e.target.value.trim())} />
      </Campo>
      <Campo id="montoBtc" etiqueta="Monto recibido (BTC)" error={errores.montoBtc}>
        <input id="montoBtc" type="number" inputMode="decimal" min="0" step="0.00000001" className={cls(errores.montoBtc)}
          placeholder="0.00012345" value={d.montoBtc} onChange={(e) => set('montoBtc', e.target.value)} />
        {tasa && <p className="mt-1 text-xs text-oliva">Cotización implícita: {moneda(tasa)} por BTC</p>}
      </Campo>
      <Confirmacion d={d} set={set} errores={errores} texto="Confirmo que el pago ya apareció en la billetera del restaurante" />
    </div>
  );
}

// ───────────── CHIVO WALLET ─────────────
export function CamposChivo({ d, set, errores }) {
  return (
    <div className="space-y-3">
      <Campo id="telefono" etiqueta="Teléfono de la cuenta Chivo" error={errores.telefono}>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-oliva">+503</span>
          <input id="telefono" inputMode="tel" autoComplete="off" className={`${cls(errores.telefono)} pl-14`} placeholder="7000-0000"
            value={d.telefono} onChange={(e) => set('telefono', formatearTelefono(e.target.value))} />
        </div>
      </Campo>
      <Campo id="titularChivo" etiqueta="Nombre del titular de la cuenta" error={errores.titularChivo}>
        <input id="titularChivo" autoComplete="off" className={cls(errores.titularChivo)} placeholder="Ej. Ana López"
          value={d.titularChivo} onChange={(e) => set('titularChivo', e.target.value)} />
      </Campo>
      <Campo id="idTransaccion" etiqueta="ID / número de confirmación" error={errores.idTransaccion}>
        <input id="idTransaccion" autoComplete="off" className={cls(errores.idTransaccion)} placeholder="Ej. CH-998877"
          value={d.idTransaccion} onChange={(e) => set('idTransaccion', e.target.value.toUpperCase())} />
      </Campo>
      <Confirmacion d={d} set={set} errores={errores} texto="Confirmo que el pago ya fue recibido en la cuenta Chivo" />
    </div>
  );
}
