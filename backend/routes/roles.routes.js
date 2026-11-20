import { Router } from 'express';
import { listarRoles } from '../controllers/roles.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, permitirRoles('Administrador'), listarRoles);

export default router;