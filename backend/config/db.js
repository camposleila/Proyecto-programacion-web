import './env.js';
import pg from 'pg';

const { Pool } = pg;

// pg entrega NUMERIC (montos) y BIGINT (conteos) como texto. Los convertimos a numero
// para que la API devuelva 3.5 y no "3.50" (si no, el frontend concatena en lugar de sumar).
pg.types.setTypeParser(1700, (valor) => parseFloat(valor)); // NUMERIC / DECIMAL
pg.types.setTypeParser(20, (valor) => parseInt(valor, 10)); // BIGINT
pg.types.setTypeParser(1082, (valor) => valor);              // DATE -> se queda como 'AAAA-MM-DD'

// Un solo pool de conexiones compartido por todo el backend
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,                       // conexiones simultáneas máximas
  idleTimeoutMillis: 30000,      // cierra conexiones inactivas tras 30 s
  connectionTimeoutMillis: 5000  // falla si no logra conectar en 5 s
});

// Evita que el servidor se caiga si una conexión inactiva falla
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

// Consulta simple con parámetros: query('SELECT * FROM insumo WHERE id_insumo = $1', [5])
export const query = (texto, parametros) => pool.query(texto, parametros);

// Ejecuta varias operaciones en una transacción (ej. una venta completa).
// Uso:
//   await withTransaction(async (client) => {
//     await client.query('INSERT INTO ...', [...]);
//     await client.query('UPDATE ...', [...]);
//   });
// Si algo lanza un error, se hace ROLLBACK automático.
export async function withTransaction(trabajo) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await trabajo(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();   // siempre devolver la conexión al pool
  }
}
