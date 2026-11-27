import { PDFViewer } from '@react-pdf/renderer';
import FacturaPDF from './FacturaPDF.jsx';

// Visor embebido (se carga con React.lazy desde DocumentoPage)
export default function VisorPDF({ factura, logo }) {
  return (
    <PDFViewer width="100%" height="100%" showToolbar style={{ border: 'none', borderRadius: 12 }}>
      <FacturaPDF factura={factura} logo={logo} />
    </PDFViewer>
  );
}
