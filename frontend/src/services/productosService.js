import { api } from './api';
import productosDemo from '../data/productos-demo.json';

// La API responde { ok, data }. Se acepta también un arreglo directo.
const desempaquetar = (r) => (r && r.data !== undefined ? r.data : r);
const NOMBRES_CATEGORIA_DEMO = {
  1: 'Bebidas calientes',
  2: 'Bebidas frías',
  3: 'Repostería',
  4: 'Empacados'
};

// Normaliza un producto a la forma que usa el POS. Tolera nombres de campo distintos.
export const normalizarProducto = (p) => ({
  id_producto: p.id_producto ?? p.id,
  nombre: p.nombre,
  precio: Number(p.precio ?? p.precio_venta ?? p.precio_unitario ?? 0),
  id_categoria: p.id_categoria ?? p.categoria_id ?? null,
  categoria: p.categoria ?? p.categoria_nombre ?? p.nombre_categoria ?? '',
  imagen: p.imagen_url ?? p.imagen ?? p.foto ?? p.url_imagen ?? null,
  activo: p.activo !== false,
  solo_demo: p.solo_demo === true
});

function catalogoDeDemostracion(aviso) {
  return {
    productos: productosDemo.map((p) => normalizarProducto({
      ...p,
      categoria: NOMBRES_CATEGORIA_DEMO[p.id_categoria] || `Categoría ${p.id_categoria}`,
      solo_demo: true
    })),
    aviso
  };
}

export async function listarProductos() {
  try {
    const lista = desempaquetar(await api.get('/productos?activo=true'));
    if (!Array.isArray(lista)) {
      throw new Error('La API devolvió un formato de productos no válido.');
    }
    const productos = lista.map(normalizarProducto).filter((p) => p.activo);
    if (productos.length) return { productos, aviso: '' };
    return catalogoDeDemostracion(
      'La API no tiene productos activos; se muestran productos de demostración.'
    );
  } catch (error) {
    return catalogoDeDemostracion(
      `No se pudo cargar el catálogo de la API (${error.message}); se muestran productos de demostración.`
    );
  }
}

export async function listarCategorias() {
  const lista = desempaquetar(await api.get('/categorias')) || [];
  return lista.map((c) => ({
    id_categoria: c.id_categoria ?? c.id,
    nombre: c.nombre
  }));
}
