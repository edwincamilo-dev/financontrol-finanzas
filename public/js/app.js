// FinanControl - aplicación web (sin frameworks). Enrutador por hash: #/panel, #/ingresos, ...

import { h, cargando, tarjetaError } from './ui.js';
import { api, sesion, alCambiarCache } from './api.js';
import * as auth from './views/auth.js';
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
    cache: { titulo: 'Caché', vista: cache },
    perfil: { titulo: 'Perfil', vista: perfil }
};

const raiz = document.getElementById('app');
const estado = { usuario: null };

let carcasa = null;
let numeroDePintado = 0;

// ---------- Navegación ----------

async function navegar() {
    const ruta = window.location.hash.replace(/^#\//, '').split('?')[0];
    const esAcceso = ruta === 'login' || ruta === 'registro';

    if (!sesion.token) {
        if (!esAcceso) {
            window.location.replace('#/login');

            return;
        }

        carcasa = null;
        estado.usuario = null;
        document.title = ruta === 'registro' ? 'Crear cuenta · FinanControl' : 'Iniciar sesión · FinanControl';
        raiz.replaceChildren(auth.render(ruta, { alEntrar: () => { window.location.hash = '#/panel'; } }));

        return;
    }

    if (esAcceso || !(ruta in RUTAS)) {
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
    // Numeración tipo índice de libro mayor (decorativa).
    const iconos = { panel: '01', ingresos: '02', gastos: '03', movimientos: '04', resumen: '05', cache: '06', perfil: '07' };

    const enlaces = Object.entries(RUTAS).map(([clave, { titulo }]) =>
        h('a', { href: `#/${clave}`, 'data-ruta': clave, 'data-testid': `nav-${clave}` },
            h('span', { class: 'nav-icono', 'aria-hidden': 'true' }, iconos[clave]),
            titulo
        )
    );

    const tituloPagina = h('h1', { class: 'barra-titulo' }, 'Panel');
    const etiquetaCache = h('span', { class: 'pastilla-cache', 'data-testid': 'cache-pastilla', title: 'Estado de la última consulta al caché' }, 'Caché: —');
    const nombreUsuario = h('span', { class: 'usuario-nombre', 'data-testid': 'usuario-nombre' });
    const principal = h('main', { id: 'vista', class: 'principal', tabindex: '-1' });

    const nodo = h('div', { class: 'app' });
    const cerrarMenu = () => nodo.classList.remove('menu-abierto');

    const menu = h('aside', { class: 'lateral', 'aria-label': 'Menú principal' },
        h('div', { class: 'marca marca-lateral' },
            h('span', { class: 'logo', 'aria-hidden': 'true' }, '$'),
            h('strong', null, 'FinanControl')
        ),
        h('nav', { onclick: cerrarMenu }, enlaces),
        h('div', { class: 'lateral-pie' },
            h('a', { href: '/api-docs', target: '_blank', rel: 'noopener', 'data-testid': 'enlace-docs' }, 'Documentación API ↗')
        )
    );

    const barra = h('header', { class: 'barra' },
        h('button', {
            type: 'button',
            class: 'icono menu-boton',
            'aria-label': 'Abrir o cerrar el menú',
            onclick: () => nodo.classList.toggle('menu-abierto')
        }, '☰'),
        tituloPagina,
        h('div', { class: 'barra-derecha' },
            etiquetaCache,
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
            etiquetaCache.textContent = `Caché: ${valor}`;
            etiquetaCache.dataset.estado = valor.toLowerCase();
            etiquetaCache.title = `Última consulta: ${ruta} → X-Cache: ${valor}`;
        },
        actualizarUsuario() {
            nombreUsuario.textContent = estado.usuario ? estado.usuario.nombre : '';
        },
        marcarActiva(ruta, titulo) {
            enlaces.forEach((enlace) => {
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
