import { query } from '../config/db.js';

// GET /api/roles  (solo Administrador)
export async function listarRoles(req, res, next) {
    try {
    const resultado = await query('SELECT id_rol, nombre FROM rol ORDER BY id_rol');
    res.json({ ok: true, data: resultado.rows });
    } catch (err) {
    next(err);
    }
}