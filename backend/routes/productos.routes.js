import { Router } from 'express';
import {
  listarProductos,
  obtenerProducto,
  crearProducto,
  actualizarProducto,
  darDeBajaProducto
} from '../controllers/productos.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

// Consultas disponibles para cualquier usuario con token autenticado
router.get('/', verificarToken, listarProductos);
router.get('/:id', verificarToken, obtenerProducto);

// Creación, edición y eliminacion. Solo permitida para roles Administrador y Gerente
router.post('/', verificarToken, permitirRoles('Administrador', 'Gerente'), crearProducto);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Gerente'), actualizarProducto);
router.delete('/:id', verificarToken, permitirRoles('Administrador', 'Gerente'), darDeBajaProducto);

export default router;