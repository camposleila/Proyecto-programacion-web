import { Router } from 'express';
import { verificarToken, permitirRoles } from '../middleware/auth.js';
import {
  crearVenta,
  listarVentas,
  obtenerVenta,
  anularVenta
} from '../controllers/ventas.controller.js';

const router = Router();

router.use(verificarToken);

router.post('/', crearVenta);
router.get('/', listarVentas);
router.get('/:id', obtenerVenta);
// Ajusta los nombres de roles según los que tengan en la tabla de roles xd -- falta que el lidel me confirme
router.patch('/:id/anular', permitirRoles('Administrador', 'Gerente'), anularVenta);

export default router;