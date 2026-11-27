import { Router } from 'express';
import {
  listarInsumos,
  obtenerInsumo,
  crearInsumo,
  actualizarInsumo,
  darDeBajaInsumo
} from '../controllers/insumos.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

// Consultas disponibles para cualquier usuario con token verificado 
router.get('/', verificarToken, listarInsumos);
router.get('/:id', verificarToken, obtenerInsumo);

// Creación, edición y eliminacion. Unicamente disponibles para los roles Administrador y Gerente
router.post('/', verificarToken, permitirRoles('Administrador', 'Gerente'), crearInsumo);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Gerente'), actualizarInsumo);
router.delete('/:id', verificarToken, permitirRoles('Administrador', 'Gerente'), darDeBajaInsumo);

export default router;