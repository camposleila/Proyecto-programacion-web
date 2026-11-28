
import { useEffect, useState } from 'react';

import Modal from '../ui/Modal.jsx';
import CampoFormulario from '../ui/CampoFormulario.jsx';
import EditorReceta from './EditorReceta.jsx';

import {
  listarCategorias,
  obtenerProducto,
  crearProducto,
  actualizarProducto
} from '../../services/productosService';

import { listarInsumos } from '../../services/insumoService';

export default function FormularioProducto({
  idProducto,
  onCerrar,
  onGuardado
}) {
  const [formulario, setFormulario] = useState({
    nombre: '',
    id_categoria: '',
    tipo_producto: 'ELABORADO',
    precio_venta: '',
    activo: true,
    receta: []
  });

  const [categorias, setCategorias] = useState([]);
  const [insumos, setInsumos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function cargarDatos() {
      try {
        setCargando(true);
        setErrorCarga('');

        const [cats, ingredientes] = await Promise.all([
          listarCategorias(),
          listarInsumos()
        ]);

        setCategorias(cats);
        setInsumos(ingredientes);

        if (idProducto) {
          const producto = await obtenerProducto(idProducto);

          setFormulario({
            nombre: producto.nombre,
            id_categoria: producto.id_categoria,
            tipo_producto: producto.tipo_producto,
            precio_venta: producto.precio_venta,
            activo: producto.activo,
            receta: producto.receta || []
          });

          // Conserva los insumos de una receta existente.
          const adicionales = (producto.receta || [])
            .filter(r => !ingredientes.some(
              i => Number(i.id_insumo) === Number(r.id_insumo)
            ))
            .map(r => ({
              ...r,
              nombre: r.insumo
            }));

          setInsumos([...ingredientes, ...adicionales]);
        }
      } catch (err) {
        setErrorCarga(err.message);
      } finally {
        setCargando(false);
      }
    }

    cargarDatos();
  }, [idProducto]);

  function cambiarCampo(campo, valor) {
    setFormulario(anterior => ({
      ...anterior,
      [campo]: valor
    }));
  }

  function cambiarTipo(tipo) {
    setFormulario(anterior => ({
      ...anterior,
      tipo_producto: tipo,
      receta: tipo === anterior.tipo_producto
        ? anterior.receta
        : []
    }));
  }

  async function guardar(e) {
    e.preventDefault();
    setError('');

    if (!formulario.nombre.trim()) {
      setError('Ingresá el nombre del producto.');
      return;
    }

    if (!formulario.id_categoria) {
      setError('Seleccioná una categoría.');
      return;
    }

    const precio = Number(formulario.precio_venta);

    if (
      formulario.precio_venta === '' ||
      !Number.isFinite(precio) ||
      precio < 0
    ) {
      setError('Ingresá un precio válido.');
      return;
    }

    if (formulario.receta.length === 0) {
      setError('Agregá al menos un insumo a la receta.');
      return;
    }

    const receta = formulario.receta.map(item => ({
      id_insumo: Number(item.id_insumo),
      cantidad: Number(item.cantidad)
    }));

    if (receta.some(item =>
      !Number.isInteger(item.id_insumo) ||
      item.id_insumo <= 0 ||
      !Number.isFinite(item.cantidad) ||
      item.cantidad <= 0
    )) {
      setError('Revisá los insumos y sus cantidades.');
      return;
    }

    const ids = receta.map(item => item.id_insumo);

    if (new Set(ids).size !== ids.length) {
      setError('No se pueden repetir insumos.');
      return;
    }

    if (
      formulario.tipo_producto === 'REVENTA' &&
      (receta.length !== 1 || receta[0].cantidad !== 1)
    ) {
      setError('La reventa debe consumir una sola unidad.');
      return;
    }

    const datos = {
      nombre: formulario.nombre.trim(),
      id_categoria: Number(formulario.id_categoria),
      tipo_producto: formulario.tipo_producto,
      precio_venta: precio,
      activo: formulario.activo,
      receta
    };

    try {
      setGuardando(true);

      if (idProducto) {
        await actualizarProducto(idProducto, datos);
      } else {
        await crearProducto(datos);
      }

      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      abierto={true}
      onCerrar={onCerrar}
      titulo={idProducto ? 'Editar producto' : 'Nuevo producto'}
      ancho="max-w-3xl"
      ocultarCerrar={guardando}
    >
      {cargando ? (
        <p className="py-8 text-center text-oliva">
          Cargando información...
        </p>
      ) : errorCarga ? (
        <div className="rounded-lg bg-red-100 p-4 text-red-700">
          {errorCarga}
        </div>
      ) : (
        <form onSubmit={guardar} className="space-y-5">

          {error && (
            <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <CampoFormulario
            id="nombre"
            etiqueta="Nombre del producto"
            obligatorio
          >
            <input
              id="nombre"
              type="text"
              className="campo"
              maxLength={100}
              value={formulario.nombre}
              onChange={e =>
                cambiarCampo('nombre', e.target.value)
              }
              required
            />
          </CampoFormulario>

          <div className="grid gap-4 sm:grid-cols-2">

            <CampoFormulario
              id="categoria"
              etiqueta="Categoría"
              obligatorio
            >
              <select
                id="categoria"
                className="campo"
                value={formulario.id_categoria}
                onChange={e =>
                  cambiarCampo('id_categoria', e.target.value)
                }
                required
              >
                <option value="">
                  Seleccionar categoría
                </option>

                {categorias.map(c => (
                  <option
                    key={c.id_categoria}
                    value={c.id_categoria}
                  >
                    {c.nombre}
                  </option>
                ))}
              </select>
            </CampoFormulario>

            <CampoFormulario
              id="tipo"
              etiqueta="Tipo de producto"
              obligatorio
            >
              <select
                id="tipo"
                className="campo"
                value={formulario.tipo_producto}
                onChange={e => cambiarTipo(e.target.value)}
                required
              >
                <option value="ELABORADO">Elaborado</option>
                <option value="REVENTA">Reventa</option>
              </select>
            </CampoFormulario>

            <CampoFormulario
              id="precio"
              etiqueta="Precio de venta ($, IVA incluido)"
              obligatorio
            >
              <input
                id="precio"
                type="number"
                min="0"
                step="0.01"
                className="campo"
                value={formulario.precio_venta}
                onChange={e =>
                  cambiarCampo('precio_venta', e.target.value)
                }
                required
              />
            </CampoFormulario>

            {idProducto && (
              <CampoFormulario
                id="activo"
                etiqueta="Estado"
              >
                <select
                  id="activo"
                  className="campo"
                  value={String(formulario.activo)}
                  onChange={e =>
                    cambiarCampo(
                      'activo',
                      e.target.value === 'true'
                    )
                  }
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </CampoFormulario>
            )}

          </div>

          <hr className="border-oliva/30" />

          <EditorReceta
            receta={formulario.receta}
            insumos={insumos}
            tipoProducto={formulario.tipo_producto}
            onChange={receta => cambiarCampo('receta', receta)}
          />

          <div className="flex justify-end gap-3 border-t border-oliva/30 pt-4">

            <button
              type="button"
              className="btn-claro"
              onClick={onCerrar}
              disabled={guardando}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-oscuro"
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar producto'}
            </button>

          </div>

        </form>
      )}
    </Modal>
  );
}
