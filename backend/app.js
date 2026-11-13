// configuración de express

import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());          // permite que el frontend (otro puerto) llame a la API
app.use(express.json());

app.use('/api', routes);  // todas las rutas cuelgan de /api

app.use(notFound);        // 404 en formato JSON
app.use(errorHandler);    // manejo global de errores

export default app;
