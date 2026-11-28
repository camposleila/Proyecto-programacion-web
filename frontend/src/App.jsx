import { Navigate, Route, Routes } from 'react-router-dom';
import RutaProtegida from './components/layout/RutaProtegida.jsx';
import Layout from './components/layout/Layout.jsx';
import Login from './pages/Login.jsx';
import CatalogoPage from './pages/CatalogoPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import DocumentoPage from './pages/DocumentoPage.jsx';
import ProximamentePage from './pages/ProximamentePage.jsx';
import InventarioPage from './pages/InventarioPage.jsx';
import ResumenPage from './pages/ResumenPage.jsx';
import ComprasPage from './pages/ComprasPage.jsx';
import CajaPage from './pages/CajaPage.jsx';

// ─────────────────────────────────────────────────────────────
// Tabla de rutas. Cada pareja reemplaza SOLO su <ProximamentePage />
// por su pantalla real; no hace falta tocar nada más de este archivo.
// ─────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/catalogo" replace />} />

          {/* Frontend 1: POS */}
          <Route path="/catalogo" element={<RutaProtegida ruta="/catalogo"><CatalogoPage /></RutaProtegida>} />
          <Route path="/checkout" element={<RutaProtegida ruta="/catalogo"><CheckoutPage /></RutaProtegida>} />
          <Route path="/documento/:id" element={<RutaProtegida ruta="/documento"><DocumentoPage /></RutaProtegida>} />

          {/* Frontend 2: Resumen e Inventario */}
          <Route path="/resumen" element={<RutaProtegida ruta="/resumen"><ResumenPage /></RutaProtegida>} />
          <Route path="/inventario" element={<RutaProtegida ruta="/inventario"><InventarioPage /></RutaProtegida>} />

          {/* Frontend 3: Compras y Caja */}
          <Route path="/compras" element={<RutaProtegida ruta="/compras"><ComprasPage /></RutaProtegida>} />
          <Route path="/caja" element={<RutaProtegida ruta="/caja"><CajaPage /></RutaProtegida>} />

          {/* Resto del equipo */}
          <Route path="/ventas" element={<RutaProtegida ruta="/ventas"><ProximamentePage nombre="Ventas" responsable="Frontend 1 (historial)" /></RutaProtegida>} />
          <Route path="/personal" element={<RutaProtegida ruta="/personal"><ProximamentePage nombre="Personal" responsable="Frontend 4" /></RutaProtegida>} />
          <Route path="*" element={<ProximamentePage nombre="Página no encontrada" />} />
        </Route>
      </Route>
    </Routes>
  );
}