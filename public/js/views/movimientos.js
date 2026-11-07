// Movimientos: ingresos y gastos juntos, con filtros, paginación y exportación a CSV.

import { h, icono, dinero, contenidoFecha, aviso, conEspera, cargando, vacio, tarjetaError } from '../ui.js';
import { api, apiLista, descargar } from '../api.js';
import { formularioFiltros, paginacion } from './comun.js';

const LIMITE = 10;
const TIPOS = [['', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']];

export async function render() {
    let pagina = 1;
    let filtros = {};
    let categorias = [];

    try {
        categorias = (await api('/api/gastos/categorias')).map((c) => c.categoria);
    } catch (error) {
        categorias = [];
    }

    const zona = h('div', { class: 'zona-lista', 'aria-live': 'polite' });

    const panelFiltros = formularioFiltros(
        [
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TIPOS },
            { nombre: 'desde', etiqueta: 'Desde', tipo: 'date' },
            { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date' },
            { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Descripción…' },
            { nombre: 'categoria', etiqueta: 'Categoría de gasto', tipo: 'select', opciones: [['', 'Todas'], ...categorias.map((c) => [c, c])] }
        ],
        (valores) => {
            filtros = valores;
            pagina = 1;
            sincronizarTipo();
            cargar();
        }
    );

    // El tipo se elige con un control segmentado. El <select> original (data-testid=filtro-tipo)
    // sigue en el formulario, oculto, y es el que se lee al filtrar.
    const selectTipo = panelFiltros.controles.tipo.entrada;
    const botonesTipo = TIPOS.map(([valor, texto]) =>
        h('button', {
            type: 'button',
            'aria-pressed': 'false',
            onclick: () => {
                selectTipo.value = valor;
                panelFiltros.nodo.requestSubmit();
            }
        }, texto)
    );

    function sincronizarTipo() {
        botonesTipo.forEach((boton, i) => boton.setAttribute('aria-pressed', String(TIPOS[i][0] === selectTipo.value)));
    }

    panelFiltros.controles.tipo.nodo.hidden = true;
    panelFiltros.nodo.prepend(
        h('div', { class: 'campo campo-segmentado', role: 'group', 'aria-labelledby': 'etiqueta-tipo' },
            h('span', { id: 'etiqueta-tipo', class: 'campo-etiqueta' }, 'Tipo'),
            h('div', { class: 'segmentado' }, botonesTipo)
        )
    );
    sincronizarTipo();

    async function cargar() {
        zona.replaceChildren(cargando());

        try {
            // La página que se muestra y, aparte, la lista filtrada completa para el saldo del pie.
            const [{ items, total }, todos] = await Promise.all([
                apiLista('/api/movimientos', { consulta: { ...filtros, pagina, limite: LIMITE } }),
                api('/api/movimientos', { consulta: filtros })
            ]);

            const saldoFiltrado = todos.reduce((suma, m) => suma + (m.tipo === 'gasto' ? -1 : 1) * Number(m.valor), 0);

            zona.replaceChildren(
                items.length === 0
                    ? vacio('Sin movimientos', Object.values(filtros).some(Boolean) ? 'Prueba con otros filtros.' : 'Cuando registres ingresos o gastos aparecerán aquí.')
                    : h('div', { class: 'tabla-contenedor' },
                        h('table', { class: 'tabla tabla-tarjetas', 'data-testid': 'tabla' },
                            h('thead', null,
                                h('tr', null,
                                    h('th', { scope: 'col' }, 'Fecha'),
                                    h('th', { scope: 'col' }, 'Tipo'),
                                    h('th', { scope: 'col' }, 'Descripción'),
                                    h('th', { scope: 'col' }, 'Categoría'),
                                    h('th', { scope: 'col', class: 'num' }, 'Valor')
                                )
                            ),
                            h('tbody', null,
                                items.map((m) =>
                                    h('tr', { 'data-testid': 'fila' },
                                        h('td', { class: 'fecha', 'data-etiqueta': 'Fecha' }, contenidoFecha(m.fecha)),
                                        h('td', { class: 'tipo', 'data-etiqueta': 'Tipo' }, h('span', { class: `insignia insignia-${m.tipo}` }, m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')),
                                        h('td', { class: 'descripcion', 'data-etiqueta': 'Descripción' }, m.descripcion),
                                        h('td', { class: m.categoria ? 'categoria' : 'categoria sin-categoria', 'data-etiqueta': 'Categoría' },
                                            m.categoria ? h('span', { class: 'pastilla pastilla-gris' }, m.categoria) : '—'),
                                        h('td', { class: `num celda-valor ${m.tipo}`, 'data-etiqueta': 'Valor' }, `${m.tipo === 'gasto' ? '−' : '+'}${dinero(m.valor)}`)
                                    )
                                )
                            ),
                            h('tfoot', null,
                                h('tr', { class: 'saldo-filtrado' },
                                    h('td', { colspan: '4', class: 'etiqueta-pie' }, 'Saldo de lo filtrado'),
                                    h('td', { class: 'num valor-pie' },
                                        h('span', { class: `resaltado ${saldoFiltrado < 0 ? 'negativo' : ''}` },
                                            h('span', { class: 'resaltado-trazo', 'aria-hidden': 'true' }),
                                            dinero(saldoFiltrado)
                                        )
                                    )
                                )
                            )
                        )
                    ),
                paginacion({ pagina, limite: LIMITE, total, singular: 'movimiento', alCambiar: (nueva) => { pagina = nueva; cargar(); } })
            );
        } catch (error) {
            zona.replaceChildren(tarjetaError(error, cargar));
        }
    }

    const botonExportar = h('button', { type: 'button', class: 'btn btn-oscuro', 'data-testid': 'exportar' }, icono('descargar'), 'Exportar CSV');

    botonExportar.addEventListener('click', () =>
        conEspera(botonExportar, async () => {
            try {
                await descargar('/api/movimientos/exportar', filtros, 'movimientos.csv');
                aviso('Archivo movimientos.csv descargado.');
            } catch (error) {
                aviso(error.message, 'error');
            }
        })
    );

    cargar();

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera cabecera-contexto' },
            h('p', { class: 'sub' }, 'Todos tus ingresos y gastos, del más reciente al más antiguo.'),
            botonExportar
        ),
        h('section', { class: 'tarjeta', 'aria-label': 'Filtros' }, panelFiltros.nodo),
        h('section', { class: 'tarjeta sin-relleno', 'aria-label': 'Lista de movimientos' }, zona)
    );
}
