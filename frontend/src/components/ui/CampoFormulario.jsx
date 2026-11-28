
export default function CampoFormulario({
  id,
  etiqueta,
  error,
  obligatorio = false,
  children
}) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta">
        {etiqueta}

        {obligatorio && (
          <span className="ml-1 text-red-600">*</span>
        )}
      </label>

      {children}

      {error && (
        <p className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
