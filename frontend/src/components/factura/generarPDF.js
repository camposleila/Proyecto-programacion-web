import { createElement } from 'react';
import logoSvg from '../../assets/tarantines_logo.svg';
import { svgAPng } from '../../utils/svgAPng';
import { numeroDocumento } from '../../utils/formatos';
import { normalizarVenta } from '../../services/ventasService';

function prepararFactura(factura) {
  const normalizada = normalizarVenta(factura);
  if (!normalizada.documento.tipo_documento) {
    throw new Error('La respuesta de venta no incluye tipo_documento.');
  }
  return normalizada;
}

// react-pdf es pesado: se carga solo cuando hace falta (import dinámico).
export async function generarBlobPDF(factura) {
  const facturaNormalizada = prepararFactura(factura);
  const [{ pdf }, { default: FacturaPDF }, logo] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./FacturaPDF.jsx'),
    svgAPng(logoSvg)
  ]);
  return pdf(createElement(FacturaPDF, { factura: facturaNormalizada, logo })).toBlob();
}

export const nombreArchivo = (factura) => {
  const d = prepararFactura(factura).documento;
  if (!d?.tipo_documento) {
    throw new Error('La venta no contiene los datos del documento requeridos para nombrar el PDF.');
  }
  return `${d.tipo_documento}_${numeroDocumento(d.serie, d.numero_documento)}.pdf`;
};

// Abre el PDF en una pestaña nueva (desde ahí se imprime o se descarga).
// Si el navegador bloquea la ventana emergente, lo descarga directamente.
export async function abrirPDF(factura) {
  const facturaNormalizada = prepararFactura(factura);
  const ventana = window.open('', '_blank'); // se abre ya, dentro del clic del usuario
  try {
    const blob = await generarBlobPDF(facturaNormalizada);
    const url = URL.createObjectURL(blob);
    if (ventana) {
      ventana.location.href = url;
    } else {
      descargarURL(url, nombreArchivo(facturaNormalizada));
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    ventana?.close();
    throw e;
  }
}

export async function descargarPDF(factura) {
  const facturaNormalizada = prepararFactura(factura);
  const blob = await generarBlobPDF(facturaNormalizada);
  const url = URL.createObjectURL(blob);
  descargarURL(url, nombreArchivo(facturaNormalizada));
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function descargarURL(url, nombre) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
