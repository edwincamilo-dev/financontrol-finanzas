// Resumen financiero: por periodo (con categorías) y mes a mes de un año.

import { h, plural, campo, seleccion, dinero, aISO, inicioDeMes, finDeMes, cargando, vacio, tarjetaError } from '../ui.js';
import { api } from '../api.js';
import { barrasMensuales, leyendaMensual, tablaCategorias } from '../charts.js';

function cifra(etiqueta, contenido, nota) {
    return h('div', { class: 'cifra' }, h('span', { class: 'campo-etiqueta' }, etiqueta), contenido, nota ? h('span', { class: 'nota' }, nota) : null);
}

export async function render() {
    const anioActual = new Date().getFullYear();
    const zonaCifras = h('div', { 'aria-live': 'polite' });
    const zonaCategorias = h('div', { 'aria-live': 'polite' });
    const zonaAnio = h('div', { 'aria-live': 'polite' });

    // ---------- Periodo ----------
    const desde = campo({ etiqueta: 'Desde', nombre: 'desde', tipo: 'date' });
    const hasta = campo({ etiqueta: 'Hasta', nombre: 'hasta', tipo: 'date' });

    const PERIODOS = [
        ['Este mes', () => [inicioDeMes(), finDeMes()]],
        ['Mes pasado', () => [inicioDeMes(-1), finDeMes(-1)]],
        ['Este año', () => [`${anioActual}-01-01`, aISO(new Date())]],
        ['Todo', () => ['', '']]
    ];

    const botonesPeriodo = PERIODOS.map(([texto, rango], indice) =>
        h('button', {
            type: 'button',
            class: 'pastilla-opcion',
            'aria-pressed': 'false',
            onclick: () => {
                [desde.entrada.value, hasta.entrada.value] = rango();
                marcarPeriodo(indice);
                cargarPeriodo();
            }
        }, texto)
    );

    function marcarPeriodo(activo) {
        botonesPeriodo.forEach((boton, i) => boton.setAttribute('aria-pressed', String(i === activo)));
    }

    // Si se escribe una fecha a mano, ningún periodo rápido queda marcado.
    [desde.entrada, hasta.entrada].forEach((entrada) => entrada.addEventListener('input', () => marcarPeriodo(-1)));

    const formularioPeriodo = h('form', { class: 'filtros', 'data-testid': 'form-periodo' },
        desde.nodo,
        hasta.nodo,
        h('div', { class: 'filtros-acciones' }, h('button', { type: 'submit', class: 'btn btn-oscuro', 'data-testid': 'calcular' }, 'Calcular'))
    );

    formularioPeriodo.addEventListener('submit', (evento) => {
        evento.preventDefault();
        cargarPeriodo();
    });

    async function cargarPeriodo() {
        zonaCifras.replaceChildren(cargando());
        zonaCategorias.replaceChildren();

        try {
            const datos = await api('/api/resumen', { consulta: { desde: desde.entrada.value, hasta: hasta.entrada.value } });

            zonaCifras.replaceChildren(
                h('div', { class: 'cifras' },
                    cifra('Ingresos',
                        h('p', { class: 'valor ingreso', 'data-testid': 'resumen-ingresos' }, dinero(datos.totalIngresos)),
                        plural(datos.cantidadIngresos, 'registro')),
                    cifra('Gastos',
                        h('p', { class: 'valor gasto', 'data-testid': 'resumen-gastos' }, dinero(datos.totalGastos)),
                        plural(datos.cantidadGastos, 'registro')),
                    cifra('Saldo del periodo',
                        h('p', { class: `valor saldo resaltado ${datos.saldo < 0 ? 'negativo' : ''}`, 'data-testid': 'resumen-saldo' },
                            h('span', { class: 'resaltado-trazo', 'aria-hidden': 'true' }),
                            dinero(datos.saldo)))
                )
            );

            zonaCategorias.replaceChildren(
                ...(datos.gastosPorCategoria.length === 0
                    ? [vacio('Sin gastos en este periodo', 'Prueba con otro rango de fechas.')]
                    : [tablaCategorias(datos.gastosPorCategoria), h('p', { class: 'nota' }, 'La categoría donde más gastas se marca en amarillo.')])
            );
        } catch (fallo) {
            if (fallo.estado === 400) {
                zonaCifras.replaceChildren(h('p', { class: 'form-error', role: 'alert' }, fallo.message));
            } else {
                zonaCifras.replaceChildren(tarjetaError(fallo, cargarPeriodo));
            }
        }
    }

    // ---------- Año ----------
    const opcionesAnio = [];

    for (let anio = anioActual; anio >= anioActual - 5; anio--) opcionesAnio.push([String(anio), String(anio)]);

    const selectorAnio = seleccion({ etiqueta: 'Año', nombre: 'anio', opciones: opcionesAnio, valor: String(anioActual) });

    selectorAnio.entrada.addEventListener('change', cargarAnio);

    async function cargarAnio() {
        zonaAnio.replaceChildren(cargando());

        try {
            const datos = await api('/api/resumen/mensual', { consulta: { anio: selectorAnio.entrada.value } });
            const mesActual = Number(datos.anio) === anioActual ? new Date().getMonth() : -1;

            zonaAnio.replaceChildren(
                ...(datos.totalIngresos === 0 && datos.totalGastos === 0
                    ? [vacio(`Sin movimientos en ${datos.anio}`, 'Elige otro año o registra ingresos y gastos.')]
                    : [
                        barrasMensuales(datos.meses, { anio: datos.anio, leyenda: false }),
                        h('div', { class: 'tabla-contenedor' },
                            h('table', { class: 'tabla', 'data-testid': 'tabla-mensual' },
                                h('caption', { class: 'solo-lectores' }, `Ingresos, gastos y saldo por mes de ${datos.anio}`),
                                h('thead', null, h('tr', null,
                                    h('th', { scope: 'col' }, 'Mes'),
                                    h('th', { scope: 'col', class: 'num' }, 'Ingresos'),
                                    h('th', { scope: 'col', class: 'num' }, 'Gastos'),
                                    h('th', { scope: 'col', class: 'num' }, 'Saldo'))),
                                h('tbody', null,
                                    datos.meses.map((m, i) => h('tr', { class: i === mesActual ? 'mes-actual' : null },
                                        h('td', { class: 'capitalizar' }, m.nombre),
                                        h('td', { class: 'num ingreso' }, dinero(m.ingresos)),
                                        h('td', { class: 'num gasto' }, dinero(m.gastos)),
                                        h('td', { class: `num ${m.saldo < 0 ? 'negativo' : ''}` }, dinero(m.saldo))
                                    )),
                                    h('tr', { class: 'total' },
                                        h('td', null, 'Total'),
                                        h('td', { class: 'num ingreso' }, dinero(datos.totalIngresos)),
                                        h('td', { class: 'num gasto' }, dinero(datos.totalGastos)),
                                        h('td', { class: `num ${datos.saldo < 0 ? 'negativo' : ''}` }, dinero(datos.saldo))
                                    )
                                )
                            )
                        )
                    ])
            );
        } catch (fallo) {
            zonaAnio.replaceChildren(tarjetaError(fallo, cargarAnio));
        }
    }

    // Por defecto: el mes actual
    [desde.entrada.value, hasta.entrada.value] = PERIODOS[0][1]();
    marcarPeriodo(0);
    cargarPeriodo();
    cargarAnio();

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera' },
            h('div', null, h('h2', null, 'Resumen'), h('p', { class: 'sub' }, 'Consulta tus totales por periodo y mes a mes.'))
        ),
        h('section', { class: 'tarjeta' },
            h('h3', null, 'Por periodo'),
            h('div', { class: 'pastillas-opciones', role: 'group', 'aria-label': 'Periodos rápidos' }, botonesPeriodo),
            formularioPeriodo,
            zonaCifras
        ),
        h('section', { class: 'tarjeta' },
            h('div', { class: 'tarjeta-cabecera' }, h('h3', null, 'Mes a mes'), leyendaMensual(), selectorAnio.nodo),
            zonaAnio
        ),
        h('section', { class: 'tarjeta' },
            h('h3', null, 'Gastos por categoría'),
            zonaCategorias
        )
    );
}
