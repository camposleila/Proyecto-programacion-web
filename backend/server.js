import './config/env.js';
import app from './app.js';
import { pool } from './config/db.js';

const PORT = process.env.PORT || 3000;
const servidor = app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));

// Cierre ordenado: al detener el servidor se cierra el pool de conexiones
const cerrar = async () => {
    servidor.close();
    await pool.end();
    process.exit(0);
};
process.on('SIGINT', cerrar);
process.on('SIGTERM', cerrar);
