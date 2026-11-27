import { lazy, Suspense, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { obtenerVenta } from '../services/ventasService';
import { descargarPDF } from '../components/factura/generarPDF.js';
import { svgAPng } from '../utils/svgAPng';
import logoSvg from '../assets/tarantines_logo.svg';

const VisorPDF = lazy(() => import('../components/factura/VisorPDF.jsx'));

// Vista imprimible de un documento ya emitido: /documento/:id  (GET /api/ventas/:id)
export default function DocumentoPage() {
  const { id } = useParams();
  const navegar = useNavigate();
  const [factura, setFactura] = useState(null);
  const [logo, setLogo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    Promise.all([obtenerVenta(id), svgAPng(logoSvg)])
      .then(([f, l]) => { if (vivo) { setFactura(f); setLogo(l); } })
      .catch((e) => vivo && setError(e.message));
    return () => { vivo = false; };
  }, [id]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => navegar(-1)} className="btn-claro flex items-center gap-2"><ArrowLeft size={16} /> Volver</button>
        {factura && (
          <button onClick={() => descargarPDF(factura)} className="btn-oscuro flex items-center gap-2">
            <Download size={16} /> Descargar PDF
          </button>
        )}
      </div>
      {error && <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el documento: {error}</p>}
      {!factura && !error && <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin" size={36} /></div>}
      {factura && (
        <div className="flex-1">
          <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" size={36} /></div>}>
            <VisorPDF factura={factura} logo={logo} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
