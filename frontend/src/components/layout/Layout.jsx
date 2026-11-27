import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Encabezado from './Encabezado.jsx';

export default function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(true);
  return (
    <div className="flex min-h-screen bg-crema">
      <Sidebar abierto={menuAbierto} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado onMenu={() => setMenuAbierto((v) => !v)} />
        <main className="flex-1 overflow-auto p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
