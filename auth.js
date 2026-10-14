const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            mensaje: 'Token requerido'
        });
    }

    const partes = authHeader.split(' ');

    if (partes.length !== 2 || partes[0] !== 'Bearer') {
        return res.status(401).json({
            mensaje: 'Formato de token inválido'
        });
    }

    const token = partes[1];

    try {
        const usuario = jwt.verify(token, process.env.JWT_SECRET);

        req.usuario = usuario;

        next();
    } catch (error) {
        return res.status(401).json({
            mensaje: 'Token inválido'
        });
    }
}

module.exports = verificarToken;