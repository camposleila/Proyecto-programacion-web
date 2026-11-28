
import { Trash2 } from 'lucide-react';
import Modal from './Modal.jsx';

export default function ModalConfirmacion({
  abierto,
  titulo,
  mensaje,
  descripcion,
  textoConfirmar = 'Confirmar',
  procesando = false,
  onConfirmar,
  onCancelar
}) {
  return (
    <Modal
      abierto={abierto}
      onCerrar={procesando ? () => {} : onCancelar}
      titulo={titulo}
      ancho="max-w-md"
      ocultarCerrar={procesando}
    >
      <div className="space-y-4 text-center">

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <Trash2 size={30} className="text-red-600" />
        </div>

        <p className="text-base font-semibold">
          {mensaje}
        </p>

        {descripcion && (
          <p className="text-sm text-oliva">
            {descripcion}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-oliva/30 pt-4">

          <button
            type="button"
            className="btn-claro"
            onClick={onCancelar}
            disabled={procesando}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            onClick={onConfirmar}
            disabled={procesando}
          >
            <Trash2 size={18} />

            {procesando
              ? 'Procesando...'
              : textoConfirmar}
          </button>

        </div>

      </div>
    </Modal>
  );
}
