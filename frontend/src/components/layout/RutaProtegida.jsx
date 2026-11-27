import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getUsuario, haySesion } from '../../utils/sesion';
import { puedeAccederRuta, rutaInicialPorRol } from '../../utils/constantes';

// Sin token guardado → manda a /login y recuerda a dónde quería ir.
export default function RutaProtegida({ children, ruta }) {
  const ubicacion = useLocation();
  if (!haySesion()) {
    return <Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />;
  }
  const usuario = getUsuario();
  if (ruta && !puedeAccederRuta(ruta, usuario.rol)) {
    return <Navigate to={rutaInicialPorRol(usuario.rol)} replace />;
  }
  return children || <Outlet />;
}
