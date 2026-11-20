import { Router } from 'express';
import { listarUsuarios, crearUsuario, actualizarUsuario } from '../controllers/usuarios.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

// Todas las rutas de usuarios: solo Administrador
router.use(verificarToken, permitirRoles('Administrador'));

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);

export default router;