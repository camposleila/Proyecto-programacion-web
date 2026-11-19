// Crea el empleado y el usuario administrador inicial.
// Uso: npm run db:admin   (se puede ejecutar varias veces, no duplica nada)
import { pool, withTransaction } from '../config/db.js';
import bcrypt from 'bcryptjs';

const NOMBRE_USUARIO = 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function crearAdmin() {
    try {
    // Si el usuario ya existe, no hacemos nada
    const existe = await pool.query('SELECT 1 FROM usuario WHERE nombre_usuario = $1', [NOMBRE_USUARIO]);
    if (existe.rows.length > 0) {
        console.log(`El usuario '${NOMBRE_USUARIO}' ya existe. No se hizo nada.`);
        return;
    }

    // Hash de la contraseña 
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    // Empleado y usuario en una sola transaccion, se crean los dos o ninguno
    await withTransaction(async (client) => {
        const sucursal = await client.query('SELECT id_sucursal FROM sucursal ORDER BY id_sucursal LIMIT 1');
        if (sucursal.rows.length === 0) {
        throw new Error('No hay sucursales. Corriste npm run db:setup?');
        }
        const idSucursal = sucursal.rows[0].id_sucursal;

        const rol = await client.query('SELECT id_rol FROM rol WHERE nombre = $1', ['Administrador']);
        if (rol.rows.length === 0) {
        throw new Error("No existe el rol 'Administrador'. Corriste npm run db:setup?");
        }
        const idRol = rol.rows[0].id_rol;

        const empleado = await client.query(
        `INSERT INTO empleado (id_sucursal, nombres, apellidos, dui, cargo, salario_mensual, fecha_ingreso)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
            RETURNING id_empleado`,
        [idSucursal, 'Administrador', 'Sistema', '00000000-0', 'Administrador', 1000]
        );
        const idEmpleado = empleado.rows[0].id_empleado;

        await client.query(
        'INSERT INTO usuario (id_empleado, id_rol, nombre_usuario, password_hash) VALUES ($1, $2, $3, $4)',
        [idEmpleado, idRol, NOMBRE_USUARIO, passwordHash]
        );
    });

    console.log(`Usuario '${NOMBRE_USUARIO}' creado correctamente.`);
    } catch (error) {
    console.error('Error:', error.message);
    } finally {
    await pool.end();   // siempre se cierra el pool, haya error o no
    }
    }

crearAdmin();