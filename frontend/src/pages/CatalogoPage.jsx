import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { listarCategorias, listarProductos } from '../services/productosService';
import { useCarrito } from '../context/CarritoContext';
import { getUsuario } from '../utils/sesion';
import TarjetaProducto from '../components/pos/TarjetaProducto.jsx';
import PanelCarrito from '../components/pos/PanelCarrito.jsx';

const ROLES_EDITAN = ['Administrador', 'Gerente'];

export default function CatalogoPage() {
  const navegar = useNavigate();
  const { agregar, cantidadDe } = useCarrito();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [avisoCatalogo, setAvisoCatalogo] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('todo');
  const puedeEditar = ROLES_EDITAN.includes(getUsuario().rol);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [resultadoProductos, cats] = await Promise.all([
          listarProductos(),
          listarCategorias().catch(() => [])
        ]);
        if (!vivo) return;
        const prods = resultadoProductos.productos;
        setProductos(prods);
        setAvisoCatalogo(resultadoProductos.aviso);
        if (cats.length) {
          setCategorias(cats);
        } else {
          const vistas = new Map();
          prods.forEach((p) => p.id_categoria != null && vistas.set(p.id_categoria, p.categoria || `Categoría ${p.id_categoria}`));
          setCategorias([...vistas].map(([id_categoria, nombre]) => ({ id_categoria, nombre })));
        }
      } catch (e) {
        if (vivo) setError(e.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter(
      (p) =>
        (categoria === 'todo' || p.id_categoria === categoria) &&
        (!q || p.nombre.toLowerCase().includes(q))
    );
  }, [productos, busqueda, categoria]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto"
            className="w-full rounded-full border border-oliva/40 bg-crema py-2.5 pl-4 pr-10 text-sm focus:border-marino focus:outline-none focus:ring-2 focus:ring-celeste"
          />
          <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-marino" />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Chip activo={categoria === 'todo'} onClick={() => setCategoria('todo')}>Todo</Chip>
          {categorias.map((c) => (
            <Chip key={c.id_categoria} activo={categoria === c.id_categoria} onClick={() => setCategoria(c.id_categoria)}>
              {c.nombre}
            </Chip>
          ))}
        </div>

        {cargando && (
          <div className="mt-16 flex justify-center"><Loader2 className="animate-spin" size={36} /></div>
        )}
        {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">No se pudo cargar el catálogo: {error}</p>}
        {avisoCatalogo && (
          <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {avisoCatalogo} Estos productos no se pueden cobrar hasta que estén registrados en la base de datos.
          </p>
        )}
        {!cargando && !error && visibles.length === 0 && (
          <p className="mt-10 text-center text-sm text-oliva">No hay productos que coincidan.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {visibles.map((p) => (
            <TarjetaProducto
              key={p.id_producto}
              producto={p}
              cantidad={cantidadDe(p.id_producto)}
              onAgregar={agregar}
              // Enlace hacia el CRUD de productos de Frontend 2 (ruta acordada con ellos)
              onEditar={puedeEditar ? (prod) => navegar(`/inventario?producto=${prod.id_producto}`) : undefined}
            />
          ))}
        </div>
      </div>

      <PanelCarrito
        className="h-[calc(100vh-9.5rem)] lg:sticky lg:top-5"
        onCobrar={() => navegar('/checkout')}
      />
    </div>
  );
}

function Chip({ activo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-1 text-sm font-semibold transition ${
        activo ? 'border-marino bg-marino text-crema' : 'border-marino bg-crema hover:bg-celeste/40'
      }`}
    >
      {children}
    </button>
  );
}
