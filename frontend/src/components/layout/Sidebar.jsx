import { NavLink } from 'react-router-dom';
import { Home, ShoppingBag, Briefcase, Truck, Archive, Users, FileText } from 'lucide-react';
import logo from '../../assets/tarantines_logo.svg';
import { getUsuario } from '../../utils/sesion';
import { puedeAccederRuta } from '../../utils/constantes';

const ENLACES = [
  { a: '/resumen', texto: 'Resumen', Icono: Home },
  { a: '/ventas', texto: 'Ventas', Icono: ShoppingBag },
  { a: '/inventario', texto: 'Inventario', Icono: Briefcase },
  { a: '/compras', texto: 'Compras', Icono: Truck },
  { a: '/caja', texto: 'Caja', Icono: Archive },
  { a: '/personal', texto: 'Personal', Icono: Users },
  // "Catálogo" es la pantalla de toma de pedidos (POS) según el diseño
  { a: '/catalogo', texto: 'Catálogo', Icono: FileText }
];

export default function Sidebar({ abierto }) {
  const usuario = getUsuario();
  const enlacesVisibles = ENLACES.filter(({ a }) => puedeAccederRuta(a, usuario.rol));

  return (
    <aside
      className={`${abierto ? 'w-64' : 'w-0 overflow-hidden'} shrink-0 bg-gradient-to-b from-marino via-[#1B3455] to-[#2C4667] text-crema transition-all duration-300`}
    >
      <div className="flex w-64 flex-col items-center px-6 pt-10">
        <img src={logo} alt="Tarantines - Restaurante Típico" className="h-44 w-44 rounded-full" />
        <nav className="mt-14 w-full space-y-1">
          {enlacesVisibles.map(({ a, texto, Icono }) => (
            <NavLink
              key={a}
              to={a}
              title={texto}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition ${
                  isActive ? 'bg-celeste text-marino' : 'text-crema hover:bg-crema/10'
                }`
              }
            >
              <Icono size={18} aria-hidden="true" />
              {texto}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  );
}
