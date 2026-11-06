// CORS con lista blanca de orígenes.
//
// Un navegador siempre envía la cabecera "Origin" cuando una página de OTRO sitio llama a la API.
// Esta política solo deja pasar los orígenes autorizados; cualquier otro recibe 403 y no se le
// entrega ninguna cabecera Access-Control-*, así que el navegador bloquea la respuesta.
//
// Configuración (.env):
//   ALLOWED_ORIGINS      Orígenes permitidos, separados por comas.
//                        Por defecto: http://localhost:3000 y http://127.0.0.1:3000
//   CORS_EXIGIR_ORIGEN   "true" para rechazar también las peticiones SIN cabecera Origin
//                        (Postman, curl, Cypress). Por defecto es "false".
//
// Siempre se permite el origen propio (la misma dirección desde la que se sirve la API), así el
// frontend de /public y la documentación de /api-docs funcionan en cualquier puerto.

const METODOS_PERMITIDOS = 'GET, POST, PUT, DELETE, OPTIONS';
const ENCABEZADOS_PERMITIDOS = 'Content-Type, Authorization, If-None-Match';
const ENCABEZADOS_EXPUESTOS = 'X-Cache, ETag, X-Total-Count, X-Page, X-Limit, Content-Disposition';
const SEGUNDOS_PREFLIGHT = '600';

const ORIGENES_POR_DEFECTO = 'http://localhost:3000,http://127.0.0.1:3000';

// Se lee en cada petición para que un cambio de .env (o de las pruebas) se note al instante.
function origenesPermitidos() {
    const lista = process.env.ALLOWED_ORIGINS === undefined || process.env.ALLOWED_ORIGINS.trim() === ''
        ? ORIGENES_POR_DEFECTO
        : process.env.ALLOWED_ORIGINS;

    return lista
        .split(',')
        .map((origen) => origen.trim().replace(/\/+$/, ''))
        .filter(Boolean);
}

function bloquear(res, mensaje) {
    res.status(403).json({ mensaje });
}

function cors(req, res, next) {
    const origen = req.headers.origin;

    // La respuesta depende del Origin: evita que un caché compartido mezcle respuestas.
    res.vary('Origin');

    if (origen === undefined) {
        if (process.env.CORS_EXIGIR_ORIGEN === 'true') {
            return bloquear(res, 'Acceso bloqueado por CORS: la petición no indica su origen');
        }

        return next();
    }

    const origenNormalizado = origen.replace(/\/+$/, '');
    const esOrigenPropio = origenNormalizado === `${req.protocol}://${req.get('host')}`;

    if (!esOrigenPropio && !origenesPermitidos().includes(origenNormalizado)) {
        return bloquear(res, 'Acceso bloqueado por CORS: el origen no está permitido');
    }

    res.set('Access-Control-Allow-Origin', origen);
    res.set('Access-Control-Expose-Headers', ENCABEZADOS_EXPUESTOS);

    // Preflight: el navegador pregunta qué se permite antes de enviar la petición real.
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', METODOS_PERMITIDOS);
        res.set('Access-Control-Allow-Headers', ENCABEZADOS_PERMITIDOS);
        res.set('Access-Control-Max-Age', SEGUNDOS_PREFLIGHT);

        return res.sendStatus(204);
    }

    next();
}

module.exports = cors;
module.exports.origenesPermitidos = origenesPermitidos;
