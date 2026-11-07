// Piezas compartidas por las listas: formulario de filtros y paginación.

import { h, icono, plural, campo, seleccion } from '../ui.js';

// definicion: [{ nombre, etiqueta, tipo: 'text' | 'date' | 'select', opciones?: [[valor, texto]] }]
// alAplicar(valores) se llama al enviar el formulario o al limpiar los filtros.
// Devuelve también "controles" ({ nombre: { entrada, nodo } }) para que la vista pueda adornar un campo.
export function formularioFiltros(definicion, alAplicar) {
    const lista = definicion.map((def) => {
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

    const valores = () => Object.fromEntries(lista.map(({ def, entrada }) => [def.nombre, entrada.value]));

    const nodo = h('form', { class: 'filtros', role: 'search', 'data-testid': 'filtros' },
        lista.map((c) => c.nodo),
        h('div', { class: 'filtros-acciones' },
            h('button', { type: 'submit', class: 'btn btn-oscuro', 'data-testid': 'filtrar' }, 'Filtrar'),
            h('button', {
                type: 'button',
                class: 'btn btn-borde',
                onclick: () => {
                    lista.forEach(({ entrada }) => { entrada.value = ''; });
                    alAplicar(valores());
                }
            }, 'Limpiar')
        )
    );

    nodo.addEventListener('submit', (evento) => {
        evento.preventDefault();
        alAplicar(valores());
    });

    const controles = Object.fromEntries(lista.map(({ def, entrada, nodo: nodoCampo }) => [def.nombre, { entrada, nodo: nodoCampo }]));

    return { nodo, valores, controles };
}

// singular / pluralTexto: cómo se llaman los elementos de la lista ("gasto" / "gastos").
export function paginacion({ pagina, limite, total, alCambiar, singular = 'resultado', pluralTexto }) {
    const paginas = Math.max(1, Math.ceil(total / limite));

    return h('nav', { class: 'paginacion', 'aria-label': 'Paginación' },
        h('span', { 'data-testid': 'paginacion-resumen' },
            total === 0 ? 'Sin resultados' : `Página ${pagina} de ${paginas} · ${plural(total, singular, pluralTexto)}`),
        h('div', { class: 'acciones' },
            h('button', {
                type: 'button',
                class: 'btn btn-borde',
                disabled: pagina <= 1,
                'data-testid': 'pagina-anterior',
                onclick: () => alCambiar(pagina - 1)
            }, icono('anterior'), 'Anterior'),
            h('button', {
                type: 'button',
                class: 'btn btn-borde',
                disabled: pagina >= paginas,
                'data-testid': 'pagina-siguiente',
                onclick: () => alCambiar(pagina + 1)
            }, 'Siguiente', icono('siguiente'))
        )
    );
}
