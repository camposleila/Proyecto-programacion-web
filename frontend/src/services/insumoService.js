import { api } from './api';
export async function listarInsumos() {
    const respuesta = await api.get('/insumos?activo=true');
    return respuesta.data ?? respuesta;
}