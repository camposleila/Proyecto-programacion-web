import { Router } from 'express';
import { health } from '../controllers/controllers.js';
import authRoutes from './auth.routes.js';
import sucursalesRoutes from './sucursales.routes.js';
import rolesRoutes from './roles.routes.js';
import empleadosRoutes from './empleados.routes.js';
import usuariosRoutes from './usuarios.routes.js';
import turnosRoutes from './caja.routes.js';
import comprasRouter from './compras.routes.js';
import cuentasPorPagarRouter from './cuentasporpagar.routes.js';
import categoriasRoutes from './categorias.routes.js';
import insumosRoutes from './insumos.routes.js';
import productosRoutes from './productos.routes.js';
import inventarioRoutes from './inventario.routes.js';


const router = Router();

// Prueba de conexión: GET /api/health
router.get('/health', health);
router.use('/auth', authRoutes);
router.use('/sucursales', sucursalesRoutes);
router.use('/roles', rolesRoutes);
router.use('/empleados', empleadosRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('./turnos', turnosRoutes)
router.use('/compras', comprasRouter);
router.use('/cuentasporpagar', cuentasPorPagarRouter );
router.use('/categorias', categoriasRoutes);
router.use('/insumos', insumosRoutes);
router.use('/productos', productosRoutes);
router.use('/inventario', inventarioRoutes);


// Cada integrante registra aquí las rutas de su modulo, en su propio archivo:
// import ventasRoutes from './ventas.routes.js';
// router.use('/ventas', ventasRoutes);

export default router;
