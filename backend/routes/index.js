import { Router } from 'express';
import { health } from '../controllers/controllers.js';
import {permitirRoles, verificarToken} from '../middleware/auth.js'

const router = Router();

// Prueba de conexión: GET /api/health
router.get('/health', health);

// Cada integrante registra aquí las rutas de su modulo, en su propio archivo:
// import ventasRoutes from './ventas.routes.js';
// router.use('/ventas', ventasRoutes);

export default router;
