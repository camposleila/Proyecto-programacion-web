// Ruta inexistente
export function notFound(req, res) {
  res.status(404).json({ ok: false, mensaje: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Manejo global de errores. Formato de error del equipo: { ok: false, mensaje }
// Para devolver un error controlado:  const e = new Error('Stock insuficiente'); e.status = 400; throw e;
export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    mensaje: status === 500 ? 'Error interno del servidor' : err.message
  });
}
