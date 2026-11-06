// Utilidades de interfaz: crear elementos, formatos, avisos y ventanas.
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

// ---------- Formatos ----------

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
});

const monedaCompacta = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });

export const dinero = (numero) => moneda.format(Number(numero) || 0);
export const dineroCompacto = (numero) => monedaCompacta.format(Number(numero) || 0);

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

export function inicioDeMes(desplazamiento = 0) {
    const ahora = new Date();

    return aISO(new Date(ahora.getFullYear(), ahora.getMonth() + desplazamiento, 1));
}

export function finDeMes(desplazamiento = 0) {
    const ahora = new Date();

    return aISO(new Date(ahora.getFullYear(), ahora.getMonth() + desplazamiento + 1, 0));
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

export function modal(titulo, contenido) {
    const id = `modal-${++contadorModales}`;
    const dialogo = h(
        'dialog',
        { class: 'modal', 'aria-labelledby': id },
        h('div', { class: 'modal-cabecera' },
            h('h2', { id }, titulo),
            h('button', { type: 'button', class: 'icono', 'aria-label': 'Cerrar', onclick: () => dialogo.close() }, '✕')
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
            h('p', null, mensaje),
            h('div', { class: 'acciones' },
                h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
                botonAcepta
            )
        ]);

        ventana.dialogo.addEventListener('close', () => resolver(decision));
        botonAcepta.focus();
    });
}

// ---------- Formularios ----------

let contadorCampos = 0;

export function campo({ etiqueta, nombre, tipo = 'text', valor = '', ayuda, ...resto }) {
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
            entrada,
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
    const textoOriginal = boton.textContent;

    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');

    try {
        return await accion();
    } finally {
        boton.disabled = false;
        boton.removeAttribute('aria-busy');
        boton.textContent = textoOriginal;
    }
}

// ---------- Estados comunes ----------

export const cargando = () => h('div', { class: 'cargando', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Cargando…');

export function vacio(titulo, texto, accion) {
    return h('div', { class: 'vacio' }, h('h3', null, titulo), h('p', null, texto), accion || null);
}

export function tarjetaError(error, reintentar) {
    return h('div', { class: 'tarjeta error-tarjeta', role: 'alert' },
        h('h3', null, 'No se pudo cargar esta sección'),
        h('p', null, error.message || 'Ocurrió un error inesperado.'),
        reintentar ? h('button', { type: 'button', class: 'btn', onclick: reintentar }, 'Reintentar') : null
    );
}
