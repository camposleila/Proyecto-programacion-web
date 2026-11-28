import { Router } from 'express';
import { listarParametros, actualizarParametro } from '../controllers/parametros.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, permitirRoles('Administrador', 'Gerente'), listarParametros);
router.put('/:clave', verificarToken, permitirRoles('Administrador'), actualizarParametro);

export default router;