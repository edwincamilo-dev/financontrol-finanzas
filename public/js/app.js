// FinanControl - aplicación web (sin frameworks). Enrutador por hash: #/panel, #/ingresos, ...

import { h, icono, iniciales, cargando, tarjetaError } from './ui.js';
import { api, sesion, alCambiarCache } from './api.js';
import * as auth from './views/auth.js';
import * as inicio from './views/inicio.js';
import * as panel from './views/panel.js';
import * as movimientos from './views/movimientos.js';
import * as resumen from './views/resumen.js';
import * as perfil from './views/perfil.js';
import * as cache from './views/cache.js';
import { crearVista } from './views/crud.js';

const ingresos = crearVista({ ruta: '/api/ingresos', titulo: 'Ingresos', singular: 'ingreso', conCategoria: false });
const gastos = crearVista({ ruta: '/api/gastos', titulo: 'Gastos', singular: 'gasto', conCategoria: true });

const RUTAS = {
    panel: { titulo: 'Panel', vista: panel },
    ingresos: { titulo: 'Ingresos', vista: ingresos },
    gastos: { titulo: 'Gastos', vista: gastos },
    movimientos: { titulo: 'Movimientos', vista: movimientos },
    resumen: { titulo: 'Resumen', vista: resumen },
    perfil: { titulo: 'Perfil', vista: perfil },
    // Herramienta de desarrollo: no va en el menú principal (ver modoDesarrollador)
    cache: { titulo: 'Caché', vista: cache, herramienta: true }
};

// ---------- Modo desarrollador ----------
// El caché sigue activo para todos (es parte de la API), pero su pantalla y la pastilla HIT/MISS
// solo se muestran a quien desarrolla: en localhost/127.0.0.1, o con ?dev=1 en la URL
// (queda guardado en sessionStorage mientras la pestaña esté abierta; ?dev=0 lo apaga).
const modoDesarrollador = (() => {
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const parametro = new URLSearchParams(window.location.search).get('dev');

    try {
        if (parametro === '1') window.sessionStorage.setItem('financontrol.dev', '1');
        if (parametro === '0') window.sessionStorage.removeItem('financontrol.dev');

        return local || window.sessionStorage.getItem('financontrol.dev') === '1';
    } catch (error) {
        // Sin sessionStorage (modo privado estricto): vale solo el parámetro de esta carga.
        return local || parametro === '1';
    }
})();

const raiz = document.getElementById('app');
const estado = { usuario: null };

let carcasa = null;
let numeroDePintado = 0;

// ---------- Navegación ----------

async function navegar() {
    const [ruta, consulta = ''] = window.location.hash.replace(/^#\//, '').split('?');
    const esAcceso = ruta === 'login' || ruta === 'registro' || ruta === 'inicio';

    if (!sesion.token) {
        if (!esAcceso) {
            // Una pantalla protegida pide iniciar sesión; cualquier otra dirección lleva a la portada.
            window.location.replace(ruta in RUTAS ? '#/login' : '#/inicio');

            return;
        }

        carcasa = null;
        estado.usuario = null;

        if (ruta === 'inicio') {
            mostrarInicio(new URLSearchParams(consulta).get('seccion'));

            return;
        }

        document.title = ruta === 'registro' ? 'Crear cuenta · FinanControl' : 'Iniciar sesión · FinanControl';
        raiz.replaceChildren(auth.render(ruta, { alEntrar: () => { window.location.hash = '#/panel'; } }));

        return;
    }

    if (esAcceso || !(ruta in RUTAS) || (RUTAS[ruta].herramienta && !modoDesarrollador)) {
        window.location.replace('#/panel');

        return;
    }

    if (!carcasa) {
        try {
            estado.usuario = await api('/api/usuarios/perfil');
        } catch (error) {
            // Si el token ya no sirve, api() redirige al acceso; otro error se muestra aquí.
            if (!sesion.token) return;

            raiz.replaceChildren(h('main', { class: 'auth' }, tarjetaError(error, navegar)));

            return;
        }

        carcasa = construirCarcasa();
        raiz.replaceChildren(carcasa.nodo);
    }

    pintarVista(ruta);
}

// Portada pública. Si ya está en pantalla, solo se desplaza a la sección pedida (sin repetir la animación).
function mostrarInicio(seccion) {
    document.title = 'FinanControl · Tu libreta de cuentas';

    if (!raiz.querySelector('.landing')) raiz.replaceChildren(inicio.render());

    if (seccion && document.getElementById(seccion)) inicio.irA(seccion);
    else window.scrollTo({ top: 0 });
}

async function pintarVista(ruta) {
    const turno = ++numeroDePintado;
    const { titulo, vista } = RUTAS[ruta];

    carcasa.marcarActiva(ruta, titulo);
    carcasa.principal.replaceChildren(cargando());

    try {
        const contenido = await vista.render({
            estado,
            alCerrarSesion: cerrarSesion,
            alActualizarUsuario: () => carcasa && carcasa.actualizarUsuario()
        });

        if (turno !== numeroDePintado || !carcasa) return;

        carcasa.principal.replaceChildren(contenido);
    } catch (error) {
        if (turno !== numeroDePintado || !carcasa || !sesion.token) return;

        carcasa.principal.replaceChildren(tarjetaError(error, () => pintarVista(ruta)));
    }
}

function cerrarSesion() {
    sesion.cerrar();
    carcasa = null;
    estado.usuario = null;

    if (window.location.hash === '#/login') {
        navegar();
    } else {
        window.location.hash = '#/login';
    }
}

// Un único oyente: la pastilla de la barra superior muestra el X-Cache de la última consulta.
alCambiarCache((info) => {
    if (carcasa) carcasa.mostrarCache(info);
});

// ---------- Estructura general (menú lateral + barra superior) ----------

function construirCarcasa() {
    const fechaLargaHoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    // Menú lateral = tapa de la libreta. Cada enlace lleva un ícono de línea con el mismo nombre de la ruta.
    const enlaces = Object.entries(RUTAS)
        .filter(([, { herramienta }]) => !herramienta)
        .map(([clave, { titulo }]) =>
            h('a', { href: `#/${clave}`, 'data-ruta': clave, 'data-testid': `nav-${clave}` }, icono(clave), titulo)
        );

    // En modo desarrollador, el caché se abre desde el pie del menú (conserva data-testid=nav-cache).
    const enlaceHerramientas = modoDesarrollador
        ? h('a', { href: '#/cache', class: 'enlace-herramientas', 'data-ruta': 'cache', 'data-testid': 'nav-cache' },
            icono('cache'),
            h('span', null, 'Herramientas: Caché'),
            h('small', null, 'Solo en modo desarrollador')
        )
        : null;

    const enlacesMarcables = enlaceHerramientas ? [...enlaces, enlaceHerramientas] : enlaces;

    const tituloPagina = h('h1', { class: 'barra-titulo' }, 'Panel');
    const etiquetaCache = modoDesarrollador
        ? h('span', { class: 'pastilla-cache', 'data-testid': 'cache-pastilla', title: 'Estado de la última consulta al caché' }, 'Caché: —')
        : null;
    const avatar = h('span', { class: 'avatar', 'aria-hidden': 'true' });
    const nombreUsuario = h('span', { class: 'usuario-nombre', 'data-testid': 'usuario-nombre' });
    const principal = h('main', { id: 'vista', class: 'principal', tabindex: '-1' });

    const nodo = h('div', { class: 'app' });
    const cerrarMenu = () => nodo.classList.remove('menu-abierto');

    const menu = h('aside', { class: 'lateral', 'aria-label': 'Menú principal' },
        h('a', { class: 'marca marca-lateral', href: '#/panel' },
            h('span', { class: 'logo-libreta', 'aria-hidden': 'true' }),
            'FinanControl'
        ),
        h('nav', { 'aria-label': 'Secciones', onclick: cerrarMenu }, enlaces),
        h('div', { class: 'lateral-pie', onclick: cerrarMenu },
            enlaceHerramientas,
            h('a', { href: '/api-docs', target: '_blank', rel: 'noopener', 'data-testid': 'enlace-docs' },
                icono('documento'),
                'Documentación de la API',
                h('span', { class: 'solo-lectores' }, ' (se abre en otra pestaña)')
            )
        )
    );

    const barra = h('header', { class: 'barra' },
        h('button', {
            type: 'button',
            class: 'btn-icono menu-boton',
            'aria-label': 'Abrir o cerrar el menú',
            onclick: () => nodo.classList.toggle('menu-abierto')
        }, icono('menu', { tam: 22 })),
        h('div', { class: 'barra-titulos' },
            tituloPagina,
            h('p', { class: 'barra-fecha' }, fechaLargaHoy)
        ),
        h('div', { class: 'barra-derecha' },
            etiquetaCache,
            avatar,
            nombreUsuario,
            h('button', { type: 'button', class: 'btn btn-texto', 'data-testid': 'cerrar-sesion', onclick: cerrarSesion }, 'Salir')
        )
    );

    nodo.append(
        menu,
        h('div', { class: 'fondo-menu', onclick: cerrarMenu }),
        h('div', { class: 'contenido' }, barra, principal)
    );

    const interfaz = {
        nodo,
        principal,
        mostrarCache({ estado: valor, ruta }) {
            if (!etiquetaCache) return;

            etiquetaCache.textContent = `Caché: ${valor}`;
            etiquetaCache.dataset.estado = valor.toLowerCase();
            etiquetaCache.title = `Última consulta: ${ruta} → X-Cache: ${valor}`;
        },
        actualizarUsuario() {
            const nombre = estado.usuario ? estado.usuario.nombre : '';

            nombreUsuario.textContent = nombre;
            avatar.textContent = iniciales(nombre);
        },
        marcarActiva(ruta, titulo) {
            enlacesMarcables.forEach((enlace) => {
                if (enlace.dataset.ruta === ruta) enlace.setAttribute('aria-current', 'page');
                else enlace.removeAttribute('aria-current');
            });

            tituloPagina.textContent = titulo;
            document.title = `${titulo} · FinanControl`;
            cerrarMenu();
            window.scrollTo({ top: 0 });
        }
    };

    interfaz.actualizarUsuario();

    return interfaz;
}

window.addEventListener('hashchange', navegar);
navegar();
