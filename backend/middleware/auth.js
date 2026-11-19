
// TEMPORAL: se tiene q reemplazar por la verificacion real del token
// COMO USARLO? router.post('/', verificarToken, permitirRoles('Administrador, 'Gerente'), crearInsumo);
export function verificarToken(req, res, next){
    req.usuario = {id_usuario: 1, id_empleado: 1, id_sucursal: 1, rol: 'Administrador'};
    next();
}

export function permitirRoles(...roles){
    return(req, res, next) => {
        if (!roles.includes(req.usuario?.rol)) {
            return res.status(403).json({ok : false, mensaje: 'No tienes permiso para realizar esta accion'});
        }
    next();
    };
}