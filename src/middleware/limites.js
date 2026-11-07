// Límite de intentos (express-rate-limit) para el inicio de sesión y el registro.
//
//   Login:    RATE_LIMIT_LOGIN_MAX intentos FALLIDOS por IP y correo cada RATE_LIMIT_VENTANA_MIN minutos
//             (por defecto 5 cada 15). Los inicios de sesión correctos no cuentan.
//   Registro: 10 por IP cada hora.
//
// Se desactiva con NODE_ENV=test (Jest) o RATE_LIMIT_DESACTIVADO=true (por ejemplo, para correr Cypress),
// porque las pruebas crean e inician sesión con muchos usuarios seguidos desde la misma IP.

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const MENSAJE = 'Demasiados intentos. Intenta de nuevo en unos minutos.';
const MAX_REGISTROS_POR_HORA = 10;

function entero(valor, porDefecto) {
    const numero = Number.parseInt(valor, 10);

    return Number.isInteger(numero) && numero > 0 ? numero : porDefecto;
}

function leerConfiguracion(env = process.env) {
    return {
        desactivado: env.NODE_ENV === 'test' || String(env.RATE_LIMIT_DESACTIVADO).toLowerCase() === 'true',
        maxLogin: entero(env.RATE_LIMIT_LOGIN_MAX, 5),
        ventanaMin: entero(env.RATE_LIMIT_VENTANA_MIN, 15)
    };
}

const responder = (req, res, next, opciones) => res.status(opciones.statusCode).json({ mensaje: MENSAJE });

function crearLimitadores(config = leerConfiguracion()) {
    if (config.desactivado) {
        const dejarPasar = (req, res, next) => next();

        return { login: dejarPasar, registro: dejarPasar };
    }

    const login = rateLimit({
        windowMs: config.ventanaMin * 60 * 1000,
        limit: config.maxLogin,
        skipSuccessfulRequests: true,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        // IP + correo: frena a quien prueba contraseñas sobre una cuenta sin bloquear a toda una red compartida.
        keyGenerator: (req) => {
            const correo = req.body && typeof req.body.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';

            return `${ipKeyGenerator(req.ip)}|${correo}`;
        },
        handler: responder
    });

    const registro = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: MAX_REGISTROS_POR_HORA,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: responder
    });

    return { login, registro };
}

module.exports = { MENSAJE, leerConfiguracion, crearLimitadores };
