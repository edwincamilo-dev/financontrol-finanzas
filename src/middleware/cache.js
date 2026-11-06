// Caché en memoria (patrón Cache-Aside) para las consultas GET de la API.
//
// - La clave incluye el id del usuario, así un usuario nunca ve datos de otro.
// - Cada entrada expira por TTL; además se invalida al crear, editar o borrar.
// - Las respuestas llevan "X-Cache: HIT|MISS" y "Cache-Control: private, no-cache".
//   Express agrega el ETag y responde 304 si el cliente ya tiene la versión vigente.

const jwt = require('jsonwebtoken');

const TTL_POR_DEFECTO = 60; // segundos
const MAX_ENTRADAS = 500;

// No existe un TTL universal: los datos que cambian más rápido viven menos.
const TTL_POR_RUTA = [
    ['/api/saldo', 30],
    ['/api/resumen', 120]
];

const entradas = new Map();
const estadisticas = new Map();

function cacheActivado() {
    return process.env.CACHE_ENABLED !== 'false';
}

function ttlPara(url) {
    const ruta = url.split('?')[0];
    const especifico = TTL_POR_RUTA.find(([prefijo]) => ruta.startsWith(prefijo));
    const base = Number(process.env.CACHE_TTL_SEGUNDOS) || TTL_POR_DEFECTO;

    return especifico && !process.env.CACHE_TTL_SEGUNDOS ? especifico[1] : base;
}

function statsDe(usuarioId) {
    if (!estadisticas.has(usuarioId)) {
        estadisticas.set(usuarioId, { hits: 0, misses: 0, invalidaciones: 0 });
    }

    return estadisticas.get(usuarioId);
}

function usuarioDelToken(req) {
    const cabecera = req.headers.authorization;

    if (!cabecera) {
        return null;
    }

    const partes = cabecera.split(' ');

    if (partes.length !== 2 || partes[0] !== 'Bearer') {
        return null;
    }

    try {
        return jwt.verify(partes[1], process.env.JWT_SECRET).id;
    } catch (error) {
        return null;
    }
}

function invalidarUsuario(usuarioId) {
    const prefijo = `${usuarioId}|`;
    let borradas = 0;

    for (const clave of entradas.keys()) {
        if (clave.startsWith(prefijo)) {
            entradas.delete(clave);
            borradas++;
        }
    }

    if (borradas > 0) {
        statsDe(usuarioId).invalidaciones++;
    }

    return borradas;
}

function reiniciar() {
    entradas.clear();
    estadisticas.clear();
}

function estadisticasDe(usuarioId) {
    const { hits, misses, invalidaciones } = statsDe(usuarioId);
    const prefijo = `${usuarioId}|`;
    const consultas = hits + misses;
    let cantidad = 0;

    for (const clave of entradas.keys()) {
        if (clave.startsWith(prefijo)) {
            cantidad++;
        }
    }

    return {
        activo: cacheActivado(),
        entradas: cantidad,
        hits,
        misses,
        invalidaciones,
        tasaAcierto: consultas === 0 ? 0 : Math.round((hits / consultas) * 1000) / 10
    };
}

function guardar(clave, valor) {
    if (entradas.size >= MAX_ENTRADAS) {
        entradas.delete(entradas.keys().next().value); // descarta la más antigua
    }

    entradas.set(clave, valor);
}

function responderDesdeCache(res, entrada) {
    res.set('X-Cache', 'HIT');
    res.set('Cache-Control', 'private, no-cache');
    res.vary('Authorization');

    for (const [nombre, valor] of Object.entries(entrada.cabeceras)) {
        res.set(nombre, valor);
    }

    return res.json(entrada.cuerpo);
}

function cacheMiddleware(req, res, next) {
    if (!cacheActivado() || req.path.startsWith('/cache')) {
        return next();
    }

    const usuarioId = usuarioDelToken(req);

    if (usuarioId === null) {
        return next(); // sin sesión válida: la ruta responderá 401
    }

    // Escrituras: si salen bien, los datos cacheados del usuario quedan viejos.
    if (req.method !== 'GET') {
        res.on('finish', () => {
            if (res.statusCode < 400) {
                invalidarUsuario(usuarioId);
            }
        });

        return next();
    }

    const clave = `${usuarioId}|${req.originalUrl}`;
    const entrada = entradas.get(clave);

    if (entrada && entrada.expiraEn > Date.now()) {
        statsDe(usuarioId).hits++;

        return responderDesdeCache(res, entrada);
    }

    statsDe(usuarioId).misses++;
    entradas.delete(clave);

    const jsonOriginal = res.json.bind(res);

    res.json = (cuerpo) => {
        if (res.statusCode === 200) {
            const cabeceras = {};

            for (const nombre of ['X-Total-Count', 'X-Page', 'X-Limit']) {
                const valor = res.get(nombre);

                if (valor !== undefined) {
                    cabeceras[nombre] = valor;
                }
            }

            guardar(clave, {
                cuerpo,
                cabeceras,
                expiraEn: Date.now() + ttlPara(req.originalUrl) * 1000
            });

            res.set('X-Cache', 'MISS');
            res.set('Cache-Control', 'private, no-cache');
            res.vary('Authorization');
        }

        return jsonOriginal(cuerpo);
    };

    next();
}

module.exports = cacheMiddleware;
module.exports.invalidarUsuario = invalidarUsuario;
module.exports.estadisticasDe = estadisticasDe;
module.exports.reiniciar = reiniciar;
module.exports.ttlPara = ttlPara;
