import { Router } from 'express';
import {
    listarCategorias,
    crearCategoria,
    actualizarCategoria
} from '../controllers/categorias.controller.js';
import { verificarToken, permitirRoles } from '../middleware/auth.js';

const router = Router();

//Consultar las categorias esta permitido para cualquier usuario verificado
router.get('/', verificarToken, listarCategorias);

//crear y actualizar nuevas categorias solo esta permitido para: administrador y gerente
router.post('/', verificarToken, permitirRoles('Administrador', 'Gerente'), crearCategoria);
router.put('/:id', verificarToken, permitirRoles('Administrador', 'Gerente'), actualizarCategoria);

export default router;
