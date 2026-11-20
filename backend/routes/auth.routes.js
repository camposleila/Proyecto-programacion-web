import { Router } from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { verificarToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', login);              // público
router.get('/me', verificarToken, me);     // requiere token

export default router;