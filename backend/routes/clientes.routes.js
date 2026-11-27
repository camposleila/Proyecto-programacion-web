import { Router } from 'express';
import { verificarToken } from '../middleware/auth.js';
import { listarClientes, crearCliente } from '../controllers/clientes.controller.js';

const router = Router();

router.use(verificarToken);

router.get('/', listarClientes);
router.post('/', crearCliente);

export default router;