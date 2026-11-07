// Panel principal: saldo, gráfica del año, gastos por categoría y últimos movimientos.

import { h, dinero, fechaLarga, vacio } from '../ui.js';
import { api, apiLista } from '../api.js';
import { barrasMensuales, barrasCategorias } from '../charts.js';

function tarjetaTotal(etiqueta, tipo, valor, testid) {
    return h('article', { class: 'tarjeta' },
        h('h3', { class: 'etiqueta-tarjeta etiqueta-color' }, h('span', { class: `cuadrito ${tipo}`, 'aria-hidden': 'true' }), etiqueta),
        h('p', { class: `valor ${tipo}`, 'data-testid': testid }, dinero(valor))
    );
}

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
                h('h2', { class: 'saludo' }, primerNombre ? `Hola, ${primerNombre}` : 'Hola'),
                h('p', { class: 'sub' }, 'Así van tus finanzas hasta hoy.')
            ),
            h('div', { class: 'acciones' },
                h('a', { class: 'btn btn-borde', href: '#/gastos' }, 'Registrar gasto'),
                h('a', { class: 'btn btn-primario', href: '#/ingresos' }, 'Registrar ingreso')
            )
        ),

        h('section', { class: 'tarjetas tarjetas-panel', 'aria-label': 'Resumen del saldo' },
            h('article', { class: 'tarjeta tarjeta-saldo' },
                h('span', { class: 'margen-libreta', 'aria-hidden': 'true' }),
                h('span', { class: 'cinta', 'aria-hidden': 'true' }),
                h('h3', { class: 'etiqueta-tarjeta' }, 'Saldo actual'),
                h('p', { class: `valor-saldo resaltado ${saldo.saldo < 0 ? 'negativo' : ''}`, 'data-testid': 'saldo-valor' },
                    h('span', { class: 'resaltado-trazo', 'aria-hidden': 'true' }),
                    dinero(saldo.saldo)
                ),
                h('p', { class: 'nota' }, 'Ingresos menos gastos')
            ),
            tarjetaTotal('Ingresos', 'ingreso', saldo.totalIngresos, 'total-ingresos'),
            tarjetaTotal('Gastos', 'gasto', saldo.totalGastos, 'total-gastos')
        ),

        sinDatos
            ? h('section', { class: 'tarjeta' },
                vacio('Tu libreta está en blanco', 'Registra tu primer ingreso o gasto y aquí verás tus gráficas.',
                    h('a', { class: 'btn btn-primario', href: '#/ingresos' }, 'Registrar mi primer ingreso')))
            : h('div', { class: 'rejilla-dos rejilla-panel' },
                h('section', { class: 'tarjeta' },
                    h('h3', null, `Ingresos y gastos de ${anio}`),
                    barrasMensuales(mensual.meses, { anio, alto: 350 })
                ),
                h('section', { class: 'tarjeta' },
                    h('h3', null, 'Gastos por categoría'),
                    categorias.length === 0
                        ? vacio('Sin gastos todavía', 'Cuando registres gastos verás en qué se va tu dinero.')
                        : [barrasCategorias(categorias), h('p', { class: 'nota' }, 'La categoría donde más gastas se marca en amarillo.')]
                )
            ),

        h('section', { class: 'tarjeta' },
            h('div', { class: 'tarjeta-cabecera' },
                h('h3', null, 'Últimos movimientos'),
                recientes.items.length > 0 ? h('a', { class: 'enlace-subrayado', href: '#/movimientos' }, 'Ver todos') : null
            ),
            recientes.items.length === 0
                ? vacio('Nada por aquí', 'Tus movimientos más recientes aparecerán en esta lista.')
                : h('ul', { class: 'lista-movimientos' },
                    recientes.items.map((m) =>
                        h('li', null,
                            h('div', { class: 'lista-texto' },
                                h('strong', null, m.descripcion),
                                h('small', null, `${fechaLarga(m.fecha)}${m.categoria ? ` · ${m.categoria}` : ''}`)
                            ),
                            h('span', { class: `valor-fila ${m.tipo}` },
                                h('span', { class: 'solo-lectores' }, m.tipo === 'ingreso' ? 'Ingreso: ' : 'Gasto: '),
                                `${m.tipo === 'gasto' ? '−' : '+'}${dinero(m.valor)}`
                            )
                        )
                    )
                )
        )
    );
}
