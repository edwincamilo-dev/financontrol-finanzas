// Utilidades de interfaz: crear elementos, íconos, formatos, avisos y ventanas.
// Todo el texto se inserta con textContent (nunca innerHTML), así los datos del usuario no pueden inyectar HTML.

const PROPIEDADES = new Set(['value', 'checked', 'selected', 'disabled', 'hidden', 'readOnly', 'required', 'multiple']);

export function h(etiqueta, atributos, ...hijos) {
    const elemento = document.createElement(etiqueta);
    const propiedades = [];

    for (const [clave, valor] of Object.entries(atributos || {})) {
        if (valor === null || valor === undefined || valor === false) continue;

        if (clave.startsWith('on') && typeof valor === 'function') {
            elemento.addEventListener(clave.slice(2).toLowerCase(), valor);
        } else if (clave === 'class') {
            elemento.className = valor;
        } else if (clave === 'style') {
            // Por CSSOM y no como atributo: la Content-Security-Policy bloquea los atributos style en línea.
            elemento.style.cssText = valor;
        } else if (PROPIEDADES.has(clave)) {
            propiedades.push([clave, valor]);
        } else {
            elemento.setAttribute(clave, valor === true ? '' : valor);
        }
    }

    agregar(elemento, hijos);

    // Las propiedades (value, disabled...) se asignan al final para que <select> ya tenga sus opciones.
    for (const [clave, valor] of propiedades) elemento[clave] = valor;

    return elemento;
}

export function agregar(elemento, hijos) {
    for (const hijo of hijos.flat(Infinity)) {
        if (hijo === null || hijo === undefined || hijo === false) continue;
        elemento.append(hijo instanceof Node ? hijo : String(hijo));
    }

    return elemento;
}

// ---------- Íconos de línea (SVG con createElementNS, sin innerHTML) ----------

const NS = 'http://www.w3.org/2000/svg';

// Trazos en una cuadrícula de 24×24; el color sale de currentColor.
const TRAZOS = {
    panel: ['M4 4h6v7H4z', 'M14 4h6v4h-6z', 'M14 12h6v8h-6z', 'M4 15h6v5H4z'],
    ingresos: ['M4 17l5-5 4 4 7-7', 'M14 9h6v6'],
    gastos: ['M4 7l5 5 4-4 7 7', 'M14 15h6V9'],
    movimientos: ['M8 4v15', 'M4 8l4-4 4 4', 'M16 20V5', 'M12 16l4 4 4-4'],
    resumen: ['M4 20h16', 'M7 16v-5', 'M12 16V6', 'M17 16v-8'],
    perfil: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M5 20a7 7 0 0 1 14 0'],
    cache: ['M13 3L5 13h6l-1 8 8-10h-6z'],
    documento: ['M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 12h7', 'M9 16h5'],
    mas: ['M12 5v14', 'M5 12h14'],
    descargar: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
    editar: ['M5 19h4L19 9l-4-4L5 15z', 'M13 7l4 4'],
    eliminar: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
    cerrar: ['M6 6l12 12', 'M18 6L6 18'],
    palomita: ['M5 12.5l4.5 4.5L19 7.5'],
    salir: ['M14 4h5v16h-5', 'M10 8l-4 4 4 4', 'M6 12h10'],
    menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
    anterior: ['M15 6l-6 6 6 6'],
    siguiente: ['M9 6l6 6-6 6'],
    volver: ['M19 12H5', 'M11 6l-6 6 6 6']
};

export function icono(nombre, { tam = 18, clase = '' } = {}) {
    const svg = document.createElementNS(NS, 'svg');

    for (const [clave, valor] of Object.entries({
        class: `icono-svg ${clase}`.trim(),
        width: tam,
        height: tam,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
        focusable: 'false'
    })) svg.setAttribute(clave, valor);

    for (const d of TRAZOS[nombre] || []) {
        const trazo = document.createElementNS(NS, 'path');

        trazo.setAttribute('d', d);
        svg.append(trazo);
    }

    return svg;
}

// "María Fernanda López" → "MF". Para el avatar.
export function iniciales(nombre) {
    const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);

    if (partes.length === 0) return '?';

    return partes.slice(0, 2).map((parte) => parte[0].toUpperCase()).join('');
}

// ---------- Formatos ----------

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

const monedaCompacta = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const decimalUno = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const dinero = (numero) => moneda.format(Number(numero) || 0);
export const dineroCompacto = (numero) => monedaCompacta.format(Number(numero) || 0);
// 53.5 → "53,5 %" (coma decimal y espacio fino antes del signo)
export const porcentaje = (numero) => `${decimalUno.format(Number(numero) || 0)} %`;

export function aISO(fecha) {
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export const hoy = () => aISO(new Date());

export function fechaLarga(iso) {
    const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);

    return new Date(anio, mes - 1, dia).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

const formatoCorto = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

// "2026-11-05" → "5 nov 2026" (día sin cero, mes abreviado en minúscula y sin punto, año).
// Para las tarjetas del celular, donde la fecha larga no deja espacio a la categoría.
export function fechaCorta(iso) {
    const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
    const partes = Object.fromEntries(
        formatoCorto.formatToParts(new Date(anio, mes - 1, dia)).map(({ type, value }) => [type, value])
    );

    return `${partes.day} ${partes.month.replace('.', '').toLocaleLowerCase('es')} ${partes.year}`;
}

// Celda de fecha de las tablas: la larga se ve en escritorio y la corta en celular (lo decide el CSS).
export function contenidoFecha(iso) {
    return [
        h('span', { class: 'fecha-larga' }, fechaLarga(iso)),
        h('span', { class: 'fecha-corta' }, fechaCorta(iso))
    ];
}

export function inicioDeMes(desplazamiento = 0) {
    const ahora = new Date();

    return aISO(new Date(ahora.getFullYear(), ahora.getMonth() + desplazamiento, 1));
}

export function finDeMes(desplazamiento = 0) {
    const ahora = new Date();

    return aISO(new Date(ahora.getFullYear(), ahora.getMonth() + desplazamiento + 1, 0));
}

export function plural(cantidad, singular, pluralTexto = `${singular}s`) {
    return `${cantidad} ${cantidad === 1 ? singular : pluralTexto}`;
}

// ---------- Avisos ----------

export function aviso(texto, tipo = 'ok') {
    const contenedor = document.getElementById('toasts');
    const nodo = h('div', { class: `toast toast-${tipo}`, role: tipo === 'error' ? 'alert' : 'status' }, texto);

    contenedor.append(nodo);
    setTimeout(() => nodo.remove(), tipo === 'error' ? 6000 : 3500);
}

// ---------- Ventanas (<dialog> trae manejo de foco y tecla Esc) ----------

let contadorModales = 0;

// opciones.subtitulo: una línea de contexto bajo el título (por ejemplo, "Se resta de tu saldo al guardarlo.")
export function modal(titulo, contenido, { subtitulo } = {}) {
    const id = `modal-${++contadorModales}`;
    const dialogo = h(
        'dialog',
        { class: 'modal', 'aria-labelledby': id, 'aria-describedby': subtitulo ? `${id}-sub` : null },
        h('span', { class: 'cinta modal-cinta', 'aria-hidden': 'true' }),
        h('div', { class: 'modal-cabecera' },
            h('div', null,
                h('h2', { id }, titulo),
                subtitulo ? h('p', { id: `${id}-sub`, class: 'modal-subtitulo' }, subtitulo) : null
            ),
            h('button', { type: 'button', class: 'btn-icono', 'aria-label': 'Cerrar', onclick: () => dialogo.close() }, icono('cerrar', { tam: 20 }))
        ),
        h('div', { class: 'modal-cuerpo' }, contenido)
    );

    dialogo.addEventListener('close', () => dialogo.remove());
    dialogo.addEventListener('click', (evento) => {
        if (evento.target === dialogo) dialogo.close();
    });

    document.body.append(dialogo);
    dialogo.showModal();

    return { dialogo, cerrar: () => dialogo.close() };
}

export function confirmar(mensaje, { acepta = 'Eliminar', titulo = '¿Estás seguro?' } = {}) {
    return new Promise((resolver) => {
        let decision = false;

        const botonAcepta = h('button', {
            type: 'button',
            class: 'btn btn-peligro',
            'data-testid': 'confirmar-si',
            onclick: () => {
                decision = true;
                ventana.cerrar();
            }
        }, acepta);

        const ventana = modal(titulo, [
            h('p', { class: 'modal-texto' }, mensaje),
            h('div', { class: 'acciones modal-pie' },
                h('button', { type: 'button', class: 'btn btn-texto', onclick: () => ventana.cerrar() }, 'Cancelar'),
                botonAcepta
            )
        ]);

        ventana.dialogo.addEventListener('close', () => resolver(decision));
        botonAcepta.focus();
    });
}

// ---------- Formularios ----------

let contadorCampos = 0;

// prefijo: texto fijo dentro del campo, a la izquierda (por ejemplo "$").
export function campo({ etiqueta, nombre, tipo = 'text', valor = '', ayuda, prefijo, ...resto }) {
    const id = `campo-${nombre}-${++contadorCampos}`;
    const entrada = h('input', {
        id,
        name: nombre,
        type: tipo,
        value: valor,
        'data-testid': `f-${nombre}`,
        'aria-describedby': ayuda ? `${id}-ayuda` : null,
        ...resto
    });

    return {
        entrada,
        nodo: h('div', { class: 'campo' },
            h('label', { for: id }, etiqueta),
            prefijo
                ? h('div', { class: 'campo-prefijo' }, h('span', { class: 'prefijo', 'aria-hidden': 'true' }, prefijo), entrada)
                : entrada,
            ayuda ? h('small', { id: `${id}-ayuda` }, ayuda) : null
        )
    };
}

export function seleccion({ etiqueta, nombre, opciones, valor = '', testid }) {
    const id = `campo-${nombre}-${++contadorCampos}`;
    const entrada = h('select', { id, name: nombre, value: valor, 'data-testid': testid || `f-${nombre}` },
        opciones.map(([val, texto]) => h('option', { value: val }, texto))
    );

    return { entrada, nodo: h('div', { class: 'campo' }, h('label', { for: id }, etiqueta), entrada) };
}

// Ejecuta una acción asíncrona deshabilitando el botón mientras tanto.
export async function conEspera(boton, accion) {
    const contenidoOriginal = [...boton.childNodes];

    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');

    try {
        return await accion();
    } finally {
        boton.disabled = false;
        boton.removeAttribute('aria-busy');
        boton.replaceChildren(...contenidoOriginal);
    }
}

// ---------- Estados comunes ----------

export const cargando = () => h('div', { class: 'cargando', role: 'status' }, 'Cargando…');

export function vacio(titulo, texto, accion) {
    return h('div', { class: 'vacio' }, h('h3', null, titulo), h('p', null, texto), accion || null);
}

export function tarjetaError(error, reintentar) {
    return h('div', { class: 'tarjeta error-tarjeta', role: 'alert' },
        h('h3', null, 'No se pudo cargar esta sección'),
        h('p', null, error.message || 'Ocurrió un error inesperado.'),
        reintentar ? h('button', { type: 'button', class: 'btn btn-borde', onclick: reintentar }, 'Reintentar') : null
    );
}
