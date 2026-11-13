// logica de las peticiones

import { query } from '../config/db.js';

// GET /api/health -> confirma que la API y la base de datos responden
export async function health(req, res, next) {
    try {
    const r = await query(
        'SELECT current_database() AS "baseDatos", (SELECT COUNT(*) FROM producto)::int AS productos'
    );
    res.json({ ok: true, ...r.rows[0] });
    } catch (err) {
    next(err);
    }
}

// IMPORTANTE: para evitar conflictos de Git, cada módulo crea su propio archivo
// de controladores (ventas.controller.js, inventario.controller.js, ...) y deja
// este archivo solo para lo general.
