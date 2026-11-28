import { Router } from 'express';
import { listarTramos } from '../controllers/parametros.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, permitirRoles('Administrador', 'Gerente'), listarTramos);

export default router;