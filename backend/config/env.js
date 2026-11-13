import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Lee el .env de la raíz del proyecto, sin importar desde dónde se ejecute
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
dotenv.config({ path: raiz });
