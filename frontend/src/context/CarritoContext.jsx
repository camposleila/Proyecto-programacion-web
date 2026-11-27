import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { calcularTotales } from '../utils/dinero';

const CarritoContext = createContext(null);

// Estado del pedido en curso: se comparte entre el catálogo (/catalogo) y el /checkout.
export function CarritoProvider({ children }) {
  const [items, setItems] = useState([]); // { id_producto, nombre, precio, imagen, cantidad }
  const [nota, setNota] = useState('');

  const agregar = useCallback((producto, cantidad = 1) => {
    setItems((prev) => {
      const existe = prev.find((i) => i.id_producto === producto.id_producto);
      if (existe) {
        return prev.map((i) =>
          i.id_producto === producto.id_producto ? { ...i, cantidad: i.cantidad + cantidad } : i
        );
      }
      return [
        ...prev,
        {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          precio: producto.precio,
          imagen: producto.imagen,
          solo_demo: producto.solo_demo === true,
          cantidad
        }
      ];
    });
  }, []);

  // Si la cantidad llega a 0 el producto sale del carrito
  const cambiarCantidad = useCallback((id, cantidad) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id_producto === id ? { ...i, cantidad } : i))
        .filter((i) => i.cantidad > 0)
    );
  }, []);

  const quitar = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id_producto !== id));
  }, []);

  const vaciar = useCallback(() => {
    setItems([]);
    setNota('');
  }, []);

  const cantidadDe = useCallback(
    (id) => items.find((i) => i.id_producto === id)?.cantidad || 0,
    [items]
  );

  const totales = useMemo(() => calcularTotales(items, 0), [items]);

  const valor = {
    items, nota, setNota, totales,
    agregar, cambiarCantidad, quitar, vaciar, cantidadDe
  };
  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCarrito() {
  const ctx = useContext(CarritoContext);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>');
  return ctx;
}
