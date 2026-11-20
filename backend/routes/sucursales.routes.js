import { Router } from 'express';
import { listarSucursales } from '../controllers/sucursales.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.get('/', verificarToken, listarSucursales);

export default router;