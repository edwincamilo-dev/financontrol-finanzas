// Página de inicio pública ("Libreta de cuentas"): encabezado, hero, "Resumen del mes" y "Cómo funciona".
// Se muestra en #/inicio cuando no hay sesión. Todos los montos son datos de ejemplo.

import { h } from '../ui.js';

const NS = 'http://www.w3.org/2000/svg';

function svg(etiqueta, atributos, ...hijos) {
    const elemento = document.createElementNS(NS, etiqueta);

    for (const [clave, valor] of Object.entries(atributos || {})) elemento.setAttribute(clave, valor);
    elemento.append(...hijos);

    return elemento;
}

// Palomita decorativa que se "dibuja" con stroke-dashoffset.
const palomita = () =>
    svg('svg', { class: 'libreta-check', viewBox: '0 0 20 20', width: '20', height: '20', 'aria-hidden': 'true', focusable: 'false' },
        svg('path', { d: 'M4 10.5l4 4 8-9', pathLength: '1' })
    );

const MOVIMIENTOS = [
    { concepto: 'Pago quincena', monto: '+ $1.300.000', tipo: 'ingreso' },
    { concepto: 'Arriendo', monto: '− $650.000', tipo: 'gasto' },
    { concepto: 'Mercado', monto: '− $210.000', tipo: 'gasto' },
    { concepto: 'Transporte', monto: '− $96.000', tipo: 'gasto' }
];

// Los mismos gastos de la libreta, agrupados: 650.000 + 210.000 + 96.000 = 956.000
const CATEGORIAS = [
    { nombre: 'Arriendo', monto: '$650.000', porcentaje: 68 },
    { nombre: 'Comida', monto: '$210.000', porcentaje: 22 },
    { nombre: 'Transporte', monto: '$96.000', porcentaje: 10 }
];

const PASOS = [
    ['Crea tu cuenta.', 'Solo necesitas tu nombre, correo y una contraseña.'],
    ['Anota cada movimiento.', 'Ingresos y gastos, con su categoría y fecha.'],
    ['Revisa tu mes.', 'El panel te muestra tu saldo y el resumen por categoría.']
];

// Lleva a una sección de esta misma página sin pasar por el enrutador por hash
// (un href="#seccion" se tomaría como una ruta). La dirección se actualiza con replaceState,
// que no dispara "hashchange"; así un enlace copiado (#/inicio?seccion=...) sigue funcionando.
// Sección elegida con irA(): al final de la página (donde puede no alcanzar a subir hasta arriba)
// se respeta la que la persona pidió.
let seccionElegida = null;

export function irA(id) {
    const destino = document.getElementById(id);

    if (!destino) return;

    seccionElegida = destino;
    window.history.replaceState(null, '', `#/inicio?seccion=${id}`);
    destino.scrollIntoView({ block: 'start' });
    window.dispatchEvent(new Event('scroll')); // actualiza el subrayado aunque la página no se haya movido
}

// Enlace real (<a href>) que, con clic normal, se desplaza con irA().
function enlaceSeccion(id, texto, atributos = {}) {
    return h('a', {
        href: `#/inicio?seccion=${id}`,
        ...atributos,
        onclick: (evento) => {
            if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.button !== 0) return;

            evento.preventDefault();
            irA(id);
        }
    }, texto);
}

export function render() {
    const mes = new Date().toLocaleDateString('es-CO', { month: 'long' });
    const nombreMes = mes.charAt(0).toUpperCase() + mes.slice(1);

    const enlaceResumen = enlaceSeccion('resumen-del-mes', 'Resumen del mes', { 'data-testid': 'landing-nav-resumen' });
    const enlaceComo = enlaceSeccion('como-funciona', 'Cómo funciona', { 'data-testid': 'landing-nav-como' });

    const cabecera = h('header', { class: 'landing-cabecera' },
        h('div', { class: 'landing-contenedor landing-fila' },
            h('a', { class: 'landing-marca', href: '#/inicio', 'aria-label': 'FinanControl, inicio' },
                h('span', { class: 'landing-logo', 'aria-hidden': 'true' }),
                h('span', null, 'FinanControl')
            ),
            h('nav', { class: 'landing-nav', 'aria-label': 'Principal' },
                enlaceComo,
                enlaceResumen,
                h('a', { href: '/api-docs', target: '_blank', rel: 'noopener' }, 'API para desarrolladores',
                    h('span', { class: 'solo-lectores' }, ' (se abre en otra pestaña)'))
            ),
            h('div', { class: 'landing-acciones' },
                h('a', { class: 'landing-ingresar', href: '#/login', 'data-testid': 'landing-ingresar' }, 'Ingresar'),
                h('a', { class: 'landing-btn landing-btn-tinta', href: '#/registro', 'data-testid': 'landing-crear-cuenta' }, 'Crear cuenta')
            )
        )
    );

    const libreta = h('figure', { class: 'libreta', 'aria-label': 'Ejemplo de libreta con movimientos del mes' },
        h('span', { class: 'libreta-cinta', 'aria-hidden': 'true' }),
        h('span', { class: 'libreta-margen', 'aria-hidden': 'true' }),
        h('div', { class: 'libreta-cabecera' },
            h('span', { class: 'libreta-mes' }, nombreMes),
            h('span', { class: 'libreta-pastilla' }, 'Ejemplo')
        ),
        h('ul', { class: 'libreta-renglones' },
            MOVIMIENTOS.map((m) =>
                h('li', { class: 'libreta-renglon' },
                    palomita(),
                    h('span', { class: 'libreta-concepto' }, m.concepto),
                    h('span', { class: `libreta-monto ${m.tipo}` }, m.monto)
                )
            )
        ),
        h('div', { class: 'libreta-saldo' },
            h('span', null, 'Te queda este mes'),
            h('strong', { class: 'libreta-saldo-valor' },
                h('span', { class: 'libreta-resaltado', 'aria-hidden': 'true' }),
                '$344.000'
            )
        )
    );

    const hero = h('section', { class: 'landing-hero landing-contenedor', 'aria-labelledby': 'hero-titulo' },
        h('div', { class: 'landing-hero-texto' },
            h('h1', { id: 'hero-titulo' }, 'Anota lo que gastas. Nosotros hacemos las cuentas.'),
            h('span', { class: 'landing-barra', 'aria-hidden': 'true' }),
            h('p', null, 'Registra ingresos y gastos en segundos, agrúpalos por categoría y mira cuánto te queda antes de que termine el mes.'),
            h('div', { class: 'landing-botones' },
                h('a', { class: 'landing-btn landing-btn-mostaza', href: '#/registro', 'data-testid': 'hero-empezar' }, 'Empezar mi libreta'),
                enlaceSeccion('como-funciona', 'Ver cómo funciona', { class: 'landing-btn landing-btn-borde' })
            )
        ),
        libreta
    );

    // Ilustra lo que entrega /api/resumen: el saldo y cuánto se gasta por categoría.
    const resumen = h('section', { id: 'resumen-del-mes', class: 'landing-resumen landing-contenedor', 'aria-labelledby': 'resumen-titulo' },
        h('div', { class: 'landing-resumen-texto' },
            h('h2', { id: 'resumen-titulo' }, 'Resumen del mes'),
            h('p', null, 'Tu panel te muestra el saldo que te queda y cuánto se va en cada categoría. Así sabes, de un vistazo, en qué se te está yendo la plata.')
        ),
        h('figure', { class: 'landing-categorias', 'aria-label': 'Ejemplo de gastos del mes por categoría' },
            h('div', { class: 'libreta-cabecera' },
                h('span', { class: 'landing-categorias-titulo' }, `Gastos de ${mes}`),
                h('span', { class: 'libreta-pastilla' }, 'Ejemplo')
            ),
            h('div', { class: 'landing-barra-apilada', 'aria-hidden': 'true' },
                CATEGORIAS.map((c, i) => h('span', { class: `segmento segmento-${i + 1}`, style: `flex:${c.porcentaje} 1 0` }))
            ),
            h('ul', { class: 'landing-leyenda' },
                CATEGORIAS.map((c, i) =>
                    h('li', null,
                        h('span', { class: `landing-punto segmento-${i + 1}`, 'aria-hidden': 'true' }),
                        h('span', { class: 'landing-leyenda-nombre' }, c.nombre),
                        h('span', { class: 'landing-leyenda-monto' }, c.monto),
                        h('span', { class: 'landing-leyenda-porcentaje' }, `${c.porcentaje}%`)
                    )
                )
            )
        )
    );

    const como = h('section', { id: 'como-funciona', class: 'landing-como landing-contenedor', 'aria-labelledby': 'como-titulo' },
        h('h2', { id: 'como-titulo' }, 'Cómo funciona'),
        h('ol', { class: 'landing-pasos' },
            PASOS.map(([titulo, texto], i) =>
                h('li', null,
                    h('span', { class: 'landing-paso-num', 'aria-hidden': 'true' }, String(i + 1)),
                    h('h3', null, titulo),
                    h('p', null, texto)
                )
            )
        )
    );

    const nodo = h('div', { class: 'landing' }, cabecera, h('main', null, hero, resumen, como));

    // Sección actual = la última cuyo borde superior ya pasó el 40% de la pantalla;
    // al llegar al final de la página gana la última. Su enlace lleva el subrayado amarillo.
    const secciones = [[resumen, enlaceResumen], [como, enlaceComo]];

    function marcarSeccion() {
        if (!nodo.isConnected) {
            window.removeEventListener('scroll', marcarSeccion);

            return;
        }

        const raiz = document.documentElement;
        const alFinal = window.scrollY > 0 && window.innerHeight + window.scrollY >= raiz.scrollHeight - 2;
        let actual = null;

        for (const [seccion] of secciones) {
            if (seccion.getBoundingClientRect().top <= window.innerHeight * 0.4) actual = seccion;
        }

        if (alFinal) {
            const elegidaVisible = seccionElegida && seccionElegida.isConnected
                && seccionElegida.getBoundingClientRect().top < window.innerHeight;

            actual = elegidaVisible ? seccionElegida : secciones[secciones.length - 1][0];
        }

        for (const [seccion, enlace] of secciones) {
            if (seccion === actual) enlace.setAttribute('aria-current', 'location');
            else enlace.removeAttribute('aria-current');
        }
    }

    window.addEventListener('scroll', marcarSeccion, { passive: true });

    return nodo;
}
