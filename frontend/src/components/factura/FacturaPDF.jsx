import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { etiquetaMetodo } from '../../utils/constantes';
import { fechaCorta, formatearIdCliente, numeroDocumento } from '../../utils/formatos';
import { moneda, r2 } from '../../utils/dinero';

// Factura / CCF en PDF. Recibe EXACTAMENTE el objeto `data` del contrato:
//   { documento, cliente, detalle, atencion, pagos, totales }
// `logo` es un data-URL PNG (ver utils/svgAPng.js).
// Paleta oficial: Prussian Blue, Baby Blue Ice, Dusty Olive, Ivory (y Cotton Candy).
// Los "suaves" son esos mismos colores mezclados con Ivory (react-pdf no usa Tailwind).
const C = {
  marino: '#0E1C36',
  celeste: '#AFCBFF',
  gris: '#7B886F',
  crema: '#F9FBF2',
  rosa: '#FFA0AC',
  grisClaro: '#E6EAE2',   // oliva 15 % sobre ivory
  borde: '#CDD3C4',       // oliva 35 % sobre ivory
  zebra: '#EFF2E8',       // oliva 8 % sobre ivory
  celesteSuave: '#DFEAF7' // celeste 35 % sobre ivory
};

const s = StyleSheet.create({
  pagina: { padding: 28, fontFamily: 'Helvetica', fontSize: 9, color: C.marino, backgroundColor: C.crema },
  // Cabecera
  cab: { backgroundColor: C.marino, borderRadius: 14, padding: 18, flexDirection: 'row', justifyContent: 'space-between', color: C.crema },
  cabIzq: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  logo: { width: 66, height: 66, marginRight: 14 },
  nombre: { fontSize: 25, fontFamily: 'Helvetica-Bold', color: C.crema },
  sub: { fontSize: 7, letterSpacing: 1.5, color: C.celeste, marginTop: 2 },
  lema: { fontSize: 9.5, color: C.crema, marginTop: 6 },
  estado: { fontSize: 6.5, color: C.celeste, marginTop: 8 },
  cabDer: { alignItems: 'flex-end' },
  insignia: { backgroundColor: C.celeste, color: C.marino, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 10, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  filaCab: { flexDirection: 'row', marginTop: 6 },
  etiquetaCab: { width: 46, color: C.celeste, fontSize: 8 },
  valorCab: { color: C.crema, fontSize: 8 },
  // Tipo de comprobante
  tipoFila: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  tipoTit: { fontSize: 6.5, color: C.gris, letterSpacing: 0.8, marginBottom: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 12, marginRight: 8, width: 120 },
  pillOn: { backgroundColor: C.marino, color: C.crema },
  pillOff: { backgroundColor: C.crema, borderWidth: 1, borderColor: C.borde, color: C.marino },
  punto: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  nota: { fontSize: 7, color: C.gris, marginLeft: 10 },
  // Secciones
  titSec: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 8 },
  fila: { flexDirection: 'row', marginBottom: 6 },
  caja: { borderRadius: 7, borderWidth: 1, borderColor: C.borde, backgroundColor: C.crema, paddingVertical: 5, paddingHorizontal: 9, marginRight: 8, minHeight: 34 },
  cajaGris: { backgroundColor: C.grisClaro, borderColor: C.grisClaro },
  lbl: { fontSize: 6.5, color: C.gris, marginBottom: 2 },
  val: { fontSize: 9.5 },
  valGris: { color: C.gris },
  micro: { fontSize: 6.5, color: C.gris, letterSpacing: 0.6, marginTop: 4, marginBottom: 5 },
  // Detalle
  tabla: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: C.borde },
  th: { flexDirection: 'row', backgroundColor: C.celesteSuave, paddingVertical: 7, paddingHorizontal: 10 },
  thTxt: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6 },
  tr: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: C.crema },
  trZebra: { backgroundColor: C.zebra },
  cCant: { width: 36 },
  cDesc: { flexGrow: 1 },
  cPrecio: { width: 70, textAlign: 'right' },
  cImp: { width: 70, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  // Pie
  pie: { flexDirection: 'row', marginTop: 14 },
  atencion: { flexGrow: 1, backgroundColor: C.celesteSuave, borderRadius: 9, padding: 12, marginRight: 12 },
  tot: { width: 190, borderRadius: 9, borderWidth: 1, borderColor: C.borde, backgroundColor: C.crema, overflow: 'hidden' },
  totFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totPagar: { backgroundColor: C.marino, padding: 10, color: C.crema },
  gracias: { marginTop: 14 },
  footer: { position: 'absolute', left: 28, right: 28, bottom: 18, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.borde, paddingTop: 6, fontSize: 6.5, color: C.gris }
});

const Caja = ({ etiqueta, valor, gris, ancho, ultimo }) => (
  <View style={[s.caja, gris && s.cajaGris, { flexGrow: ancho ? 0 : 1, width: ancho, marginRight: ultimo ? 0 : 8 }]}>
    <Text style={s.lbl}>{etiqueta}</Text>
    <Text style={[s.val, gris && s.valGris]}>{valor}</Text>
  </View>
);

export default function FacturaPDF({ factura, logo }) {
  const { documento: doc, cliente, detalle = [], atencion = {}, pagos = [], totales = {} } = factura;
  const esCCF = doc.tipo_documento === 'CCF';
  const etiquetaDoc = esCCF ? 'CCF' : 'FACTURA';
  const suma = totales.suma_lineas ?? r2(detalle.reduce((a, l) => a + l.total_linea, 0));
  const descuento = totales.descuento || 0;
  const pct = suma > 0 ? Math.round((descuento / suma) * 100) : 0;
  const na = (v) => (v ? v : 'No aplica');

  const textoPago = pagos
    .map((p) => `${etiquetaMetodo(p.metodo_pago).toLowerCase()} · ${moneda(p.monto)}${p.referencia ? ` · Ref. ${p.referencia}` : ''}`)
    .join('   |   ');

  return (
    <Document title={`${etiquetaDoc} ${numeroDocumento(doc.serie, doc.numero_documento)}`} author="Tarantines">
      <Page size="A4" style={s.pagina}>
        {/* ── Cabecera ── */}
        <View style={s.cab}>
          <View style={s.cabIzq}>
            {logo && <Image src={logo} style={s.logo} />}
            <View>
              <Text style={s.nombre}>Tarantines</Text>
              <Text style={s.sub}>RESTAURANTE TÍPICO</Text>
              <Text style={s.lema}>El sabor de nuestras raíces.</Text>
              <Text style={s.estado}>{String(doc.estado || '').toUpperCase()}</Text>
            </View>
          </View>
          <View style={s.cabDer}>
            <Text style={s.insignia}>{etiquetaDoc} / {numeroDocumento(doc.serie, doc.numero_documento)}</Text>
            <View style={s.filaCab}><Text style={s.etiquetaCab}>Emisión</Text><Text style={s.valorCab}>{fechaCorta(doc.fecha)}</Text></View>
            <View style={s.filaCab}><Text style={s.etiquetaCab}>Moneda</Text><Text style={s.valorCab}>{doc.moneda || 'USD'} · $</Text></View>
          </View>
        </View>

        {/* ── Tipo de comprobante ── */}
        <Text style={[s.tipoTit, { marginTop: 14 }]}>TIPO DE COMPROBANTE</Text>
        <View style={[s.tipoFila, { marginTop: 0 }]}>
          <View style={[s.pill, !esCCF ? s.pillOn : s.pillOff]}>
            <View style={[s.punto, { backgroundColor: !esCCF ? C.crema : C.borde }]} />
            <Text style={{ color: !esCCF ? C.crema : C.marino }}>Consumidor final</Text>
          </View>
          <View style={[s.pill, esCCF ? s.pillOn : s.pillOff]}>
            <View style={[s.punto, { backgroundColor: esCCF ? C.crema : C.borde }]} />
            <Text style={{ color: esCCF ? C.crema : C.marino }}>Crédito fiscal</Text>
          </View>
          <Text style={s.nota}>Gris = no aplica al tipo elegido</Text>
        </View>

        {/* ── 01 Datos del cliente ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={s.titSec}>01 / Datos del cliente</Text>
          <Text style={{ fontSize: 7, color: C.gris, marginBottom: 8 }}>* Campo requerido</Text>
        </View>
        <View style={s.fila}>
          <Caja etiqueta="Nombre del cliente / razón social *" valor={cliente?.nombre || 'Consumidor final'} />
          <Caja etiqueta="Email · opcional" valor={cliente?.email || '—'} ultimo />
        </View>
        <View style={s.fila}>
          <Caja etiqueta="ID cliente · opcional" valor={cliente?.id_cliente != null ? formatearIdCliente(cliente.id_cliente) : '—'} ancho={150} />
          <Caja etiqueta="DUI · opcional" valor={cliente?.dui || '—'} />
          <Caja etiqueta={esCCF ? 'NIT *' : 'NIT · opcional'} valor={cliente?.nit || '—'} ultimo />
        </View>
        <Text style={s.micro}>SOLO CRÉDITO FISCAL · Se completan al elegir ese comprobante</Text>
        <View style={s.fila}>
          <Caja gris={!esCCF} etiqueta="NRC" valor={esCCF ? cliente?.nrc || '—' : 'No aplica'} />
          <Caja gris={!esCCF} etiqueta="Contribuyente · sí / no" valor={esCCF ? 'Sí' : 'No'} ultimo />
        </View>
        <View style={s.fila}>
          <Caja gris={!esCCF} etiqueta="Giro" valor={esCCF ? cliente?.giro || '—' : 'No aplica'} />
          <Caja gris={!esCCF} etiqueta="Dirección" valor={esCCF ? cliente?.direccion || 'Sin especificar' : 'Sin especificar'} ultimo />
        </View>

        {/* ── 02 Detalle ── */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <Text style={s.titSec}>02 / Detalle del consumo</Text>
          <Text style={{ fontSize: 7, color: C.gris, marginBottom: 8 }}>Precios en USD · IVA incluido</Text>
        </View>
        <View style={s.tabla}>
          <View style={s.th} fixed>
            <Text style={[s.thTxt, s.cCant]}>CANT.</Text>
            <Text style={[s.thTxt, s.cDesc]}>DESCRIPCIÓN</Text>
            <Text style={[s.thTxt, s.cPrecio]}>P. UNITARIO</Text>
            <Text style={[s.thTxt, s.cImp, { fontFamily: 'Helvetica-Bold' }]}>IMPORTE</Text>
          </View>
          {detalle.map((l, i) => (
            <View key={`${l.id_producto}-${i}`} style={[s.tr, i % 2 === 1 && s.trZebra]} wrap={false}>
              <Text style={s.cCant}>{l.cantidad}</Text>
              <Text style={s.cDesc}>{l.nombre}</Text>
              <Text style={s.cPrecio}>{moneda(l.precio_unitario)}</Text>
              <Text style={s.cImp}>{moneda(l.total_linea)}</Text>
            </View>
          ))}
        </View>

        {/* ── 03 Atención + totales ── */}
        <View style={s.pie} wrap={false}>
          <View style={s.atencion}>
            <Text style={{ fontSize: 11.5, fontFamily: 'Helvetica-Bold', marginBottom: 8 }}>03 / Datos de atención</Text>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 110 }}>
                <Text style={s.lbl}>SUCURSAL</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{atencion.sucursal || '—'}</Text>
              </View>
              <View>
                <Text style={s.lbl}>EMPLEADO</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{atencion.empleado || '—'}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 7, color: C.gris, marginTop: 10 }}>Pago: {textoPago || '—'}</Text>
          </View>

          <View style={s.tot}>
            <View style={{ padding: 10 }}>
              {descuento > 0 && (
                <>
                  <View style={s.totFila}><Text>Productos</Text><Text>{moneda(suma)}</Text></View>
                  <View style={s.totFila}><Text>Descuento ({pct}%)</Text><Text>-{moneda(descuento)}</Text></View>
                </>
              )}
              <View style={s.totFila}><Text>Subtotal sin IVA</Text><Text>{moneda(totales.subtotal)}</Text></View>
              <View style={s.totFila}><Text>IVA incluido (13%)</Text><Text>{moneda(totales.iva)}</Text></View>
            </View>
            <View style={s.totPagar}>
              <Text style={{ fontSize: 6.5, letterSpacing: 1, color: C.celeste }}>TOTAL A PAGAR</Text>
              <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginTop: 4 }}>{moneda(totales.total)}</Text>
            </View>
          </View>
        </View>

        <View style={s.gracias} wrap={false}>
          <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 0.8 }}>UNA MESA, MUCHAS HISTORIAS.</Text>
          <Text style={{ fontSize: 8.5, color: C.gris, marginTop: 4, lineHeight: 1.4 }}>Gracias por compartir la nuestra.</Text>
          <Text style={{ fontSize: 8.5, color: C.gris, lineHeight: 1.4 }}>¡Te esperamos pronto en Tarantines!</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Comprobante generado por el sistema Tarantines</Text>
          <Text render={({ pageNumber, totalPages }) => `${String(pageNumber).padStart(2, '0')} / ${String(totalPages).padStart(2, '0')}`} />
        </View>
      </Page>
    </Document>
  );
}
