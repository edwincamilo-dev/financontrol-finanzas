// Resumen financiero: por periodo (con categorías) y mes a mes de un año.

import { h, campo, seleccion, dinero, aISO, inicioDeMes, finDeMes, cargando, vacio, tarjetaError } from '../ui.js';
import { api } from '../api.js';
import { barrasMensuales, barrasCategorias } from '../charts.js';

export async function render() {
    const anioActual = new Date().getFullYear();
    const zonaPeriodo = h('div', { 'aria-live': 'polite' });
    const zonaAnio = h('div', { 'aria-live': 'polite' });

    // ---------- Periodo ----------
    const desde = campo({ etiqueta: 'Desde', nombre: 'desde', tipo: 'date' });
    const hasta = campo({ etiqueta: 'Hasta', nombre: 'hasta', tipo: 'date' });

    function aplicarPreset(inicio, fin) {
        desde.entrada.value = inicio;
        hasta.entrada.value = fin;
        cargarPeriodo();
    }

    const presets = h('div', { class: 'presets', 'aria-label': 'Periodos rápidos' },
        h('button', { type: 'button', class: 'btn btn-texto', onclick: () => aplicarPreset(inicioDeMes(), finDeMes()) }, 'Este mes'),
        h('button', { type: 'button', class: 'btn btn-texto', onclick: () => aplicarPreset(inicioDeMes(-1), finDeMes(-1)) }, 'Mes pasado'),
        h('button', { type: 'button', class: 'btn btn-texto', onclick: () => aplicarPreset(`${anioActual}-01-01`, aISO(new Date())) }, 'Este año'),
        h('button', { type: 'button', class: 'btn btn-texto', onclick: () => aplicarPreset('', '') }, 'Todo')
    );

    const formularioPeriodo = h('form', { class: 'filtros', 'data-testid': 'form-periodo' },
        desde.nodo,
        hasta.nodo,
        h('div', { class: 'filtros-acciones' }, h('button', { type: 'submit', class: 'btn btn-secundario', 'data-testid': 'calcular' }, 'Calcular')),
        presets
    );

    formularioPeriodo.addEventListener('submit', (evento) => {
        evento.preventDefault();
        cargarPeriodo();
    });

    async function cargarPeriodo() {
        zonaPeriodo.replaceChildren(cargando());

        try {
            const datos = await api('/api/resumen', { consulta: { desde: desde.entrada.value, hasta: hasta.entrada.value } });

            zonaPeriodo.replaceChildren(
                h('div', { class: 'tarjetas' },
                    h('article', { class: 'tarjeta' }, h('h3', null, 'Ingresos'),
                        h('p', { class: 'valor ingreso', 'data-testid': 'resumen-ingresos' }, dinero(datos.totalIngresos)),
                        h('p', { class: 'sub' }, `${datos.cantidadIngresos} ${datos.cantidadIngresos === 1 ? 'registro' : 'registros'}`)),
                    h('article', { class: 'tarjeta' }, h('h3', null, 'Gastos'),
                        h('p', { class: 'valor gasto', 'data-testid': 'resumen-gastos' }, dinero(datos.totalGastos)),
                        h('p', { class: 'sub' }, `${datos.cantidadGastos} ${datos.cantidadGastos === 1 ? 'registro' : 'registros'}`)),
                    h('article', { class: 'tarjeta destacada' }, h('h3', null, 'Saldo del periodo'),
                        h('p', { class: `valor ${datos.saldo < 0 ? 'negativo' : ''}`, 'data-testid': 'resumen-saldo' }, dinero(datos.saldo)))
                ),
                h('section', { class: 'tarjeta' },
                    h('h3', null, 'Gastos por categoría'),
                    datos.gastosPorCategoria.length === 0
                        ? vacio('Sin gastos en este periodo', 'Prueba con otro rango de fechas.')
                        : barrasCategorias(datos.gastosPorCategoria)
                )
            );
        } catch (fallo) {
            if (fallo.estado === 400) {
                zonaPeriodo.replaceChildren(h('p', { class: 'form-error', role: 'alert' }, fallo.message));
            } else {
                zonaPeriodo.replaceChildren(tarjetaError(fallo, cargarPeriodo));
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

            zonaAnio.replaceChildren(
                ...(datos.totalIngresos === 0 && datos.totalGastos === 0
                    ? [vacio(`Sin movimientos en ${datos.anio}`, 'Elige otro año o registra ingresos y gastos.')]
                    : [
                        barrasMensuales(datos.meses),
                        h('div', { class: 'tabla-contenedor' },
                            h('table', { class: 'tabla', 'data-testid': 'tabla-mensual' },
                                h('thead', null, h('tr', null,
                                    h('th', null, 'Mes'), h('th', { class: 'num' }, 'Ingresos'), h('th', { class: 'num' }, 'Gastos'), h('th', { class: 'num' }, 'Saldo'))),
                                h('tbody', null,
                                    datos.meses.map((m) => h('tr', null,
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
    desde.entrada.value = inicioDeMes();
    hasta.entrada.value = finDeMes();
    cargarPeriodo();
    cargarAnio();

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera' },
            h('div', null, h('h2', null, 'Resumen'), h('p', { class: 'sub' }, 'Consulta tus totales por periodo y mes a mes.'))
        ),
        h('section', { class: 'tarjeta' }, h('h3', null, 'Por periodo'), formularioPeriodo),
        zonaPeriodo,
        h('section', { class: 'tarjeta' },
            h('div', { class: 'tarjeta-cabecera' }, h('h3', null, 'Mes a mes'), selectorAnio.nodo),
            zonaAnio
        )
    );
}
