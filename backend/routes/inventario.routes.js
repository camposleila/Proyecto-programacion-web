import { Router } from 'express';
import {
  listarStock,
  listarMovimientos,
  registrarMovimiento
} from '../controllers/inventario.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

//Consulta disponible para cualquier usuario con token autenticado
router.get('/', verificarToken, listarStock);
router.get('/movimientos', verificarToken, listarMovimientos);

//Registro de movimientos o ajustes solo para roles Administrador y Gerente
router.post('/movimientos', verificarToken, permitirRoles('Administrador', 'Gerente'), registrarMovimiento);

export default router;