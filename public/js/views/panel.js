// Panel principal: saldo, gráfica del año, gastos por categoría y últimos movimientos.

import { h, dinero, fechaLarga, vacio } from '../ui.js';
import { api, apiLista } from '../api.js';
import { barrasMensuales, barrasCategorias } from '../charts.js';

export async function render({ estado }) {
    const anio = new Date().getFullYear();

    const [saldo, mensual, categorias, recientes] = await Promise.all([
        api('/api/saldo'),
        api('/api/resumen/mensual', { consulta: { anio } }),
        api('/api/gastos/categorias'),
        apiLista('/api/movimientos', { consulta: { pagina: 1, limite: 6 } })
    ]);

    const sinDatos = saldo.totalIngresos === 0 && saldo.totalGastos === 0;
    const primerNombre = (estado.usuario && estado.usuario.nombre ? estado.usuario.nombre : '').split(' ')[0];

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera' },
            h('div', null,
                h('h2', null, primerNombre ? `Hola, ${primerNombre}` : 'Hola'),
                h('p', { class: 'sub' }, 'Así van tus finanzas hasta hoy.')
            ),
            h('div', { class: 'acciones' },
                h('a', { class: 'btn btn-secundario', href: '#/gastos' }, 'Registrar gasto'),
                h('a', { class: 'btn btn-primario', href: '#/ingresos' }, 'Registrar ingreso')
            )
        ),

        h('section', { class: 'tarjetas', 'aria-label': 'Resumen del saldo' },
            h('article', { class: 'tarjeta destacada' },
                h('h3', null, 'Saldo actual'),
                h('p', { class: `valor grande ${saldo.saldo < 0 ? 'negativo' : ''}`, 'data-testid': 'saldo-valor' }, dinero(saldo.saldo)),
                h('p', { class: 'sub' }, 'Ingresos menos gastos')
            ),
            h('article', { class: 'tarjeta' },
                h('h3', null, 'Ingresos'),
                h('p', { class: 'valor ingreso', 'data-testid': 'total-ingresos' }, dinero(saldo.totalIngresos))
            ),
            h('article', { class: 'tarjeta' },
                h('h3', null, 'Gastos'),
                h('p', { class: 'valor gasto', 'data-testid': 'total-gastos' }, dinero(saldo.totalGastos))
            )
        ),

        sinDatos
            ? h('section', { class: 'tarjeta' },
                vacio('Aún no tienes movimientos', 'Registra tu primer ingreso o gasto y aquí verás tus gráficas.',
                    h('a', { class: 'btn btn-primario', href: '#/ingresos' }, 'Registrar mi primer ingreso')))
            : h('div', { class: 'rejilla-dos' },
                h('section', { class: 'tarjeta' },
                    h('h3', null, `Ingresos y gastos de ${anio}`),
                    barrasMensuales(mensual.meses)
                ),
                h('section', { class: 'tarjeta' },
                    h('h3', null, 'Gastos por categoría'),
                    categorias.length === 0
                        ? vacio('Sin gastos todavía', 'Cuando registres gastos verás en qué se va tu dinero.')
                        : barrasCategorias(categorias)
                )
            ),

        h('section', { class: 'tarjeta' },
            h('div', { class: 'tarjeta-cabecera' },
                h('h3', null, 'Últimos movimientos'),
                h('a', { href: '#/movimientos' }, 'Ver todos')
            ),
            recientes.items.length === 0
                ? vacio('Nada por aquí', 'Tus movimientos más recientes aparecerán en esta lista.')
                : h('ul', { class: 'lista-movimientos' },
                    recientes.items.map((m) =>
                        h('li', null,
                            h('span', { class: `insignia insignia-${m.tipo}` }, m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
                            h('div', { class: 'lista-texto' },
                                h('strong', null, m.descripcion),
                                h('small', null, `${fechaLarga(m.fecha)}${m.categoria ? ` · ${m.categoria}` : ''}`)
                            ),
                            h('span', { class: `valor-fila ${m.tipo}` }, `${m.tipo === 'gasto' ? '−' : '+'}${dinero(m.valor)}`)
                        )
                    )
                )
        )
    );
}
