import { Router } from 'express';
import {
  listarPlanillas, obtenerPlanilla, generarPlanilla,
  aprobarPlanilla, pagarPlanilla, eliminarBorrador
} from '../controllers/planillas.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de planillas: solo Administrador y Gerente
router.use(verificarToken, permitirRoles('Administrador', 'Gerente'));

router.get('/', listarPlanillas);
router.post('/generar', generarPlanilla);
router.get('/:id', obtenerPlanilla);
router.patch('/:id/aprobar', aprobarPlanilla);
router.patch('/:id/pagar', pagarPlanilla);
router.delete('/:id', eliminarBorrador);

export default router;