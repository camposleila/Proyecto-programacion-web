import { Router } from 'express';
import { health } from '../controllers/controllers.js';

const router = Router();

// Prueba de conexión: GET /api/health
router.get('/health', health);

// Cada integrante registra aquí las rutas de su módulo, en su propio archivo:
// import ventasRoutes from './ventas.routes.js';
// router.use('/ventas', ventasRoutes);

export default router;
