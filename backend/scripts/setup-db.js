// Crea la base de datos, el usuario de la aplicación, las tablas y los datos semilla.
//   npm run db:setup   -> crea todo
//   npm run db:reset   -> borra la base y la vuelve a crear
import '../config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirDb = path.resolve(aqui, '../../database');
const reset = process.argv.includes('--reset');

const HOST = process.env.DB_HOST || 'localhost';
const PUERTO = Number(process.env.DB_PORT || 5432);
const NOMBRE_DB = process.env.DB_NAME || 'origenes_sv';
const USUARIO_APP = process.env.DB_USER || 'origenes_app';
const CLAVE_APP = process.env.DB_PASSWORD;
const USUARIO_ADMIN = process.env.DB_ADMIN_USER || 'postgres';
const CLAVE_ADMIN = process.env.DB_ADMIN_PASSWORD;

if (!CLAVE_ADMIN || !CLAVE_APP) {
  console.error('Faltan DB_ADMIN_PASSWORD o DB_PASSWORD. Copia .env.example como .env en la raiz del proyecto.');
  process.exit(1);
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Conecta con reintentos (por si el contenedor aun esta arrancando)
async function conectar(opciones) {
  const intentos = 15;
  for (let i = 1; i <= intentos; i++) {
    const client = new Client({ host: HOST, port: PUERTO, connectionTimeoutMillis: 5000, ...opciones });
    try {
      await client.connect();
      return client;
    } catch (err) {
      await client.end().catch(() => {});
      // Credenciales incorrectas o base inexistente: no tiene sentido reintentar
      if (['28P01', '28000', '3D000'].includes(err.code) || i === intentos) throw err;
      console.log(`Esperando a PostgreSQL (${i}/${intentos})...`);
      await esperar(2000);
    }
  }
}

// Arma una sentencia con identificadores y literales bien escapados (lo hace el propio servidor)
async function formato(client, plantilla, ...valores) {
  const marcadores = valores.map((_, i) => `$${i + 2}::text`).join(', ');
  const r = await client.query(`SELECT format($1::text, ${marcadores}) AS q`, [plantilla, ...valores]);
  return r.rows[0].q;
}

async function prepararBaseYUsuario() {
  const admin = await conectar({ user: USUARIO_ADMIN, password: CLAVE_ADMIN, database: 'postgres' });
  try {
    if (reset) {
      console.log(`Borrando la base ${NOMBRE_DB}...`);
      await admin.query(await formato(admin, 'DROP DATABASE IF EXISTS %I WITH (FORCE)', NOMBRE_DB));
    }

    const rol = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [USUARIO_APP]);
    if (rol.rowCount === 0) {
      console.log(`Creando el usuario ${USUARIO_APP}...`);
      await admin.query(await formato(admin, 'CREATE ROLE %I LOGIN PASSWORD %L', USUARIO_APP, CLAVE_APP));
    } else {
      // Mantiene la clave sincronizada con el .env
      await admin.query(await formato(admin, 'ALTER ROLE %I LOGIN PASSWORD %L', USUARIO_APP, CLAVE_APP));
    }

    const db = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [NOMBRE_DB]);
    if (db.rowCount === 0) {
      console.log(`Creando la base ${NOMBRE_DB}...`);
      await admin.query(await formato(admin, 'CREATE DATABASE %I OWNER %I', NOMBRE_DB, USUARIO_APP));
    }
  } finally {
    await admin.end();
  }
}

async function crearTablasYSemilla() {
  const app = await conectar({ user: USUARIO_APP, password: CLAVE_APP, database: NOMBRE_DB });
  try {
    await app.query('BEGIN');   // todo o nada: si algo falla no queda nada a medias
    for (const archivo of ['01_schema.sql', '02_datos_semilla.sql']) {
      console.log(`Ejecutando ${archivo}...`);
      await app.query(fs.readFileSync(path.join(dirDb, archivo), 'utf8'));
    }
    await app.query('COMMIT');
  } catch (err) {
    await app.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await app.end();
  }
}

async function main() {
  await prepararBaseYUsuario();
  await crearTablasYSemilla();
  console.log(`Listo: base ${NOMBRE_DB} y usuario ${USUARIO_APP} creados.`);
}

main().catch((err) => {
  if (err.code === '42P07') {
    console.error('La base ya tiene las tablas. Usa: npm run db:reset');
  } else if (err.code === '28P01') {
    console.error('Clave incorrecta. Revisa DB_ADMIN_PASSWORD (o DB_PASSWORD) en tu .env.');
  } else {
    console.error('Error:', err.message);
  }
  process.exit(1);
});
