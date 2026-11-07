// Comunicación con la API de FinanControl (todas las llamadas pasan por aquí).

const CLAVE_TOKEN = 'financontrol.token';

let tokenEnMemoria = null;
let aviso = null;
const oyentesCache = new Set();

function leerAlmacen() {
    try {
        return window.localStorage.getItem(CLAVE_TOKEN);
    } catch (error) {
        return tokenEnMemoria;
    }
}

function escribirAlmacen(valor) {
    tokenEnMemoria = valor;

    try {
        if (valor) window.localStorage.setItem(CLAVE_TOKEN, valor);
        else window.localStorage.removeItem(CLAVE_TOKEN);
    } catch (error) {
        // Sin almacenamiento (modo privado): el token vive solo mientras la página esté abierta.
    }
}

export const sesion = {
    get token() {
        return leerAlmacen() || tokenEnMemoria;
    },
    guardar(token) {
        escribirAlmacen(token);
    },
    cerrar() {
        escribirAlmacen(null);
    }
};

// Mensaje para mostrar en la pantalla de acceso (por ejemplo "tu sesión expiró"). Se lee una sola vez.
export function tomarAviso() {
    const actual = aviso;
    aviso = null;

    return actual;
}

// Cada respuesta que trae X-Cache (MISS o HIT) avisa a la interfaz.
export function alCambiarCache(oyente) {
    oyentesCache.add(oyente);
}

export class ErrorApi extends Error {
    constructor(mensaje, estado) {
        super(mensaje);
        this.name = 'ErrorApi';
        this.estado = estado;
    }
}

function armarUrl(ruta, consulta) {
    const url = new URL(ruta, window.location.origin);

    for (const [clave, valor] of Object.entries(consulta || {})) {
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
            url.searchParams.set(clave, String(valor).trim());
        }
    }

    return url;
}

// confirmaPassword: la ruta responde 401 cuando la contraseña es incorrecta (no significa sesión vencida).
async function solicitar(ruta, { metodo = 'GET', consulta, cuerpo, sinCache = false, confirmaPassword = false } = {}) {
    const cabeceras = { Accept: 'application/json' };

    if (sesion.token) cabeceras.Authorization = `Bearer ${sesion.token}`;
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';

    let respuesta;

    try {
        respuesta = await fetch(armarUrl(ruta, consulta), {
            method: metodo,
            headers: cabeceras,
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
            cache: sinCache ? 'no-store' : 'default'
        });
    } catch (error) {
        throw new ErrorApi('No se pudo conectar con el servidor. Revisa que esté encendido.', 0);
    }

    const estadoCache = respuesta.headers.get('X-Cache');

    if (estadoCache) {
        oyentesCache.forEach((oyente) => oyente({ estado: estadoCache, ruta }));
    }

    if (respuesta.status === 401 && sesion.token && !confirmaPassword && !ruta.endsWith('/login')) {
        sesion.cerrar();
        aviso = 'Tu sesión expiró. Inicia sesión de nuevo.';
        window.location.hash = '#/login';

        throw new ErrorApi('Tu sesión expiró. Inicia sesión de nuevo.', 401);
    }

    return respuesta;
}

async function leerJson(respuesta) {
    try {
        return await respuesta.json();
    } catch (error) {
        return null;
    }
}

function fallar(respuesta, datos) {
    const mensajes = {
        403: 'El servidor rechazó el origen de esta página (CORS).',
        404: 'No se encontró lo que buscabas.',
        429: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
        500: 'El servidor tuvo un problema. Inténtalo de nuevo.'
    };

    throw new ErrorApi((datos && datos.mensaje) || mensajes[respuesta.status] || 'Ocurrió un error inesperado.', respuesta.status);
}

// Llamada normal: devuelve el JSON de la respuesta.
export async function api(ruta, opciones) {
    const respuesta = await solicitar(ruta, opciones);
    const datos = await leerJson(respuesta);

    if (!respuesta.ok) fallar(respuesta, datos);

    return datos;
}

// Para listas paginadas: devuelve { items, total } (el total llega en X-Total-Count).
export async function apiLista(ruta, opciones) {
    const respuesta = await solicitar(ruta, opciones);
    const datos = await leerJson(respuesta);

    if (!respuesta.ok) fallar(respuesta, datos);

    const total = Number(respuesta.headers.get('X-Total-Count'));

    return { items: datos, total: Number.isFinite(total) && total > 0 ? total : datos.length };
}

// Para medir el caché: devuelve el estado X-Cache y el tiempo que tardó la respuesta.
export async function apiMedida(ruta) {
    const inicio = performance.now();
    const respuesta = await solicitar(ruta, { sinCache: true });
    const datos = await leerJson(respuesta);
    const milisegundos = performance.now() - inicio;

    if (!respuesta.ok) fallar(respuesta, datos);

    return { cache: respuesta.headers.get('X-Cache') || 'sin caché', milisegundos, datos };
}

// Descarga de archivos (CSV) con la sesión iniciada.
export async function descargar(ruta, consulta, nombreSugerido) {
    const respuesta = await solicitar(ruta, { consulta });

    if (!respuesta.ok) fallar(respuesta, await leerJson(respuesta));

    const blob = await respuesta.blob();
    const enlace = document.createElement('a');

    enlace.href = URL.createObjectURL(blob);
    enlace.download = nombreSugerido;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}
