// Piezas compartidas por las listas: formulario de filtros y paginación.

import { h, campo, seleccion } from '../ui.js';

// definicion: [{ nombre, etiqueta, tipo: 'text' | 'date' | 'select', opciones?: [[valor, texto]] }]
// alAplicar(valores) se llama al enviar el formulario o al limpiar los filtros.
export function formularioFiltros(definicion, alAplicar) {
    const controles = definicion.map((def) => {
        if (def.tipo === 'select') {
            return { def, ...seleccion({ etiqueta: def.etiqueta, nombre: def.nombre, opciones: def.opciones, testid: `filtro-${def.nombre}` }) };
        }

        return {
            def,
            ...campo({
                etiqueta: def.etiqueta,
                nombre: def.nombre,
                tipo: def.tipo || 'text',
                placeholder: def.placeholder,
                'data-testid': `filtro-${def.nombre}`
            })
        };
    });

    const valores = () => Object.fromEntries(controles.map(({ def, entrada }) => [def.nombre, entrada.value]));

    const nodo = h('form', { class: 'filtros', role: 'search', 'data-testid': 'filtros' },
        controles.map((c) => c.nodo),
        h('div', { class: 'filtros-acciones' },
            h('button', { type: 'submit', class: 'btn btn-secundario', 'data-testid': 'filtrar' }, 'Filtrar'),
            h('button', {
                type: 'button',
                class: 'btn btn-texto',
                onclick: () => {
                    controles.forEach(({ entrada }) => { entrada.value = ''; });
                    alAplicar(valores());
                }
            }, 'Limpiar')
        )
    );

    nodo.addEventListener('submit', (evento) => {
        evento.preventDefault();
        alAplicar(valores());
    });

    return { nodo, valores };
}

export function paginacion({ pagina, limite, total, alCambiar }) {
    const paginas = Math.max(1, Math.ceil(total / limite));
    const desde = total === 0 ? 0 : (pagina - 1) * limite + 1;
    const hasta = Math.min(pagina * limite, total);

    return h('nav', { class: 'paginacion', 'aria-label': 'Paginación' },
        h('span', { 'data-testid': 'paginacion-resumen' }, total === 0 ? 'Sin resultados' : `${desde}–${hasta} de ${total}`),
        h('div', { class: 'acciones' },
            h('button', {
                type: 'button',
                class: 'btn btn-secundario',
                disabled: pagina <= 1,
                'data-testid': 'pagina-anterior',
                onclick: () => alCambiar(pagina - 1)
            }, '← Anterior'),
            h('span', { class: 'pagina-actual' }, `Página ${pagina} de ${paginas}`),
            h('button', {
                type: 'button',
                class: 'btn btn-secundario',
                disabled: pagina >= paginas,
                'data-testid': 'pagina-siguiente',
                onclick: () => alCambiar(pagina + 1)
            }, 'Siguiente →')
        )
    );
}
