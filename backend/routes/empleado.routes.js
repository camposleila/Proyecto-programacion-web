import { Router } from 'express';
import {
    listarEmpleados, obtenerEmpleado, crearEmpleado, actualizarEmpleado, darDeBajaEmpleado
} from '../controllers/empleados.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de empleados: solo Administrador y Gerente
router.use(verificarToken, permitirRoles('Administrador', 'Gerente'));

router.get('/', listarEmpleados);
router.get('/:id', obtenerEmpleado);
router.post('/', crearEmpleado);
router.put('/:id', actualizarEmpleado);
router.delete('/:id', darDeBajaEmpleado);

export default router;