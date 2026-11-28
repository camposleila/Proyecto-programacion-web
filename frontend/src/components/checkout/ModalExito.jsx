import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import MiniaturaFactura from '../factura/MiniaturaFactura.jsx';
import { abrirPDF } from '../factura/generarPDF.js';

export default function ModalExito({ factura, vuelto = 0, onNuevaVenta }) {
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const verPDF = async () => {
    setGenerando(true);
    setError('');
    try {
      await abrirPDF(factura);
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e.message}`);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <Modal abierto={Boolean(factura)} onCerrar={onNuevaVenta} ancho="max-w-md">
      <div className="flex flex-col items-center px-4 pb-2 pt-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#34C759]">
          <Check size={52} strokeWidth={3} className="text-crema" />
        </div>
        <h2 className="mt-5 text-2xl font-bold">Pago completado exitosamente</h2>

        {vuelto > 0 && (
          <div className="mt-4 w-full max-w-[260px] rounded-xl bg-celeste px-4 py-3">
            <p className="text-sm font-semibold">Vuelto a entregar</p>
            <p className="text-3xl font-bold">${vuelto.toFixed(2)}</p>
          </div>
        )}

        <div className="mt-4"><MiniaturaFactura factura={factura} /></div>

        <button onClick={verPDF} disabled={generando} className="btn-claro mt-4 flex w-full max-w-[230px] items-center justify-center gap-2 py-3">
          {generando && <Loader2 size={16} className="animate-spin" />}
          Ver/Descargar PDF
        </button>
        <button onClick={onNuevaVenta} className="btn-oscuro mt-2 w-full max-w-[230px] py-3">Nueva venta</button>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {factura?.cliente?.email && (
          <p className="mt-3 text-xs text-oliva">Se enviará por correo a {factura.cliente.email}</p>
        )}
      </div>
    </Modal>
  );
}
