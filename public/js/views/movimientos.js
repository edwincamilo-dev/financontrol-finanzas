// Movimientos: ingresos y gastos juntos, con filtros, paginación y exportación a CSV.

import { h, dinero, fechaLarga, aviso, conEspera, cargando, vacio, tarjetaError } from '../ui.js';
import { api, apiLista, descargar } from '../api.js';
import { formularioFiltros, paginacion } from './comun.js';

const LIMITE = 10;

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
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: [['', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']] },
            { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Descripción…' },
            { nombre: 'desde', etiqueta: 'Desde', tipo: 'date' },
            { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date' },
            { nombre: 'categoria', etiqueta: 'Categoría de gasto', tipo: 'select', opciones: [['', 'Todas'], ...categorias.map((c) => [c, c])] }
        ],
        (valores) => {
            filtros = valores;
            pagina = 1;
            cargar();
        }
    );

    async function cargar() {
        zona.replaceChildren(cargando());

        try {
            const { items, total } = await apiLista('/api/movimientos', { consulta: { ...filtros, pagina, limite: LIMITE } });

            zona.replaceChildren(
                items.length === 0
                    ? vacio('Sin movimientos', Object.values(filtros).some(Boolean) ? 'Prueba con otros filtros.' : 'Cuando registres ingresos o gastos aparecerán aquí.')
                    : h('div', { class: 'tabla-contenedor' },
                        h('table', { class: 'tabla', 'data-testid': 'tabla' },
                            h('thead', null,
                                h('tr', null,
                                    h('th', null, 'Fecha'),
                                    h('th', null, 'Tipo'),
                                    h('th', null, 'Descripción'),
                                    h('th', null, 'Categoría'),
                                    h('th', { class: 'num' }, 'Valor')
                                )
                            ),
                            h('tbody', null,
                                items.map((m) =>
                                    h('tr', { 'data-testid': 'fila' },
                                        h('td', null, fechaLarga(m.fecha)),
                                        h('td', null, h('span', { class: `insignia insignia-${m.tipo}` }, m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto')),
                                        h('td', null, m.descripcion),
                                        h('td', null, m.categoria ? h('span', { class: 'etiqueta' }, m.categoria) : '—'),
                                        h('td', { class: `num ${m.tipo}` }, `${m.tipo === 'gasto' ? '−' : '+'}${dinero(m.valor)}`)
                                    )
                                )
                            )
                        )
                    ),
                paginacion({ pagina, limite: LIMITE, total, alCambiar: (nueva) => { pagina = nueva; cargar(); } })
            );
        } catch (error) {
            zona.replaceChildren(tarjetaError(error, cargar));
        }
    }

    const botonExportar = h('button', { type: 'button', class: 'btn btn-secundario', 'data-testid': 'exportar' }, 'Exportar CSV');

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
        h('header', { class: 'vista-cabecera' },
            h('div', null, h('h2', null, 'Movimientos'), h('p', { class: 'sub' }, 'Todos tus ingresos y gastos, del más reciente al más antiguo.')),
            botonExportar
        ),
        h('section', { class: 'tarjeta' }, panelFiltros.nodo),
        h('section', { class: 'tarjeta sin-relleno' }, zona)
    );
}
