import { query } from '../config/db.js';

// GET /api/sucursales  (cualquier usuario autenticado)
export async function listarSucursales(req, res, next) {
    try {
    const resultado = await query(
        'SELECT id_sucursal, nombre, direccion, telefono FROM sucursal WHERE activa ORDER BY nombre'
    );
    res.json({ ok: true, data: resultado.rows });
    } catch (err) {
    next(err);
    }
}