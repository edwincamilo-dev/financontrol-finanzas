// Gráficas sin librerías: SVG para las barras mensuales y HTML para las categorías.
// Los colores salen de styles.css (clases barra-ingreso, barra-gasto, relleno, mayor...).

import { h, dinero, dineroCompacto, porcentaje } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';

function s(etiqueta, atributos, ...hijos) {
    const elemento = document.createElementNS(NS, etiqueta);

    for (const [clave, valor] of Object.entries(atributos || {})) {
        elemento.setAttribute(clave, valor);
    }

    for (const hijo of hijos) {
        elemento.append(hijo instanceof Node ? hijo : String(hijo));
    }

    return elemento;
}

// Redondea el máximo a un valor "bonito" (1, 2, 5 x 10^n) para que las líneas guía queden limpias.
function maximoLimpio(valor) {
    if (valor <= 0) return 1;

    const potencia = 10 ** Math.floor(Math.log10(valor));
    const fraccion = valor / potencia;
    const paso = fraccion <= 1 ? 1 : fraccion <= 2 ? 2 : fraccion <= 5 ? 5 : 10;

    return paso * potencia;
}

export function leyendaMensual() {
    return h('div', { class: 'leyenda' },
        h('span', null, h('i', { class: 'punto punto-ingreso', 'aria-hidden': 'true' }), 'Ingresos'),
        h('span', null, h('i', { class: 'punto punto-gasto', 'aria-hidden': 'true' }), 'Gastos')
    );
}

// meses: [{ nombre, ingresos, gastos, saldo }] (12 elementos)
// opciones.anio: si es el año en curso, el mes actual se marca con fondo amarillo muy claro.
// opciones.leyenda: false cuando la leyenda va en la cabecera de la tarjeta.
// opciones.alto: alto del dibujo (sobre un ancho de 560); más alto = gráfica más alta en pantalla.
export function barrasMensuales(meses, { anio = new Date().getFullYear(), leyenda = true, alto = 280 } = {}) {
    const ancho = 560;
    const margen = { izquierda: 50, derecha: 6, arriba: 12, abajo: 30 };
    const areaAncho = ancho - margen.izquierda - margen.derecha;
    const areaAlto = alto - margen.arriba - margen.abajo;
    const maximo = maximoLimpio(Math.max(...meses.flatMap((m) => [m.ingresos, m.gastos])));
    const grupo = areaAncho / meses.length;
    const barra = Math.min(grupo * 0.3, 20);
    const escala = (valor) => (valor / maximo) * areaAlto;
    const base = margen.arriba + areaAlto;
    const mesActual = Number(anio) === new Date().getFullYear() ? new Date().getMonth() : -1;

    // Resumen para lectores de pantalla: solo los meses con movimientos.
    const conDatos = meses.filter((m) => m.ingresos || m.gastos);
    const resumen = conDatos.length
        ? conDatos.map((m) => `${m.nombre}: ingresos ${dinero(m.ingresos)}, gastos ${dinero(m.gastos)}`).join('; ')
        : 'sin movimientos';

    const svg = s('svg', {
        viewBox: `0 0 ${ancho} ${alto}`,
        class: 'grafica',
        role: 'img',
        'aria-label': `Ingresos y gastos por mes de ${anio}. ${resumen}.`
    });

    if (mesActual >= 0) {
        svg.append(s('rect', {
            x: margen.izquierda + grupo * mesActual, y: margen.arriba - 6, width: grupo, height: areaAlto + 6 + 24, rx: 6, class: 'mes-actual'
        }));
    }

    for (let i = 1; i <= 4; i++) {
        const valor = (maximo / 4) * i;
        const y = base - escala(valor);

        svg.append(
            s('line', { x1: margen.izquierda, x2: ancho - margen.derecha, y1: y, y2: y, class: 'guia' }),
            s('text', { x: margen.izquierda - 8, y: y + 4, class: 'eje', 'text-anchor': 'end' }, dineroCompacto(valor))
        );
    }

    meses.forEach((mes, indice) => {
        const x0 = margen.izquierda + grupo * indice + (grupo - barra * 2 - 3) / 2;
        const altoIngreso = escala(mes.ingresos);
        const altoGasto = escala(mes.gastos);

        svg.append(
            s('g', { class: 'grupo' },
                s('title', {}, `${mes.nombre}: ingresos ${dinero(mes.ingresos)} · gastos ${dinero(mes.gastos)}`),
                s('rect', { x: x0, y: base - altoIngreso, width: barra, height: altoIngreso, rx: 3, class: 'barra-ingreso' }),
                s('rect', { x: x0 + barra + 3, y: base - altoGasto, width: barra, height: altoGasto, rx: 3, class: 'barra-gasto' }),
                // Zona transparente para que el tooltip aparezca al pasar sobre todo el mes
                s('rect', { x: margen.izquierda + grupo * indice, y: margen.arriba, width: grupo, height: areaAlto, fill: 'transparent' })
            ),
            s('text', {
                x: margen.izquierda + grupo * indice + grupo / 2,
                y: alto - 8,
                class: indice === mesActual ? 'eje actual' : 'eje',
                'text-anchor': 'middle'
            }, mes.nombre.slice(0, 3))
        );
    });

    // Línea base azul marino
    svg.append(s('line', { x1: margen.izquierda, x2: ancho - margen.derecha, y1: base, y2: base, class: 'base' }));

    return h('figure', { class: 'figura' }, svg, leyenda ? h('figcaption', null, leyendaMensual()) : null);
}

// Panel: barras horizontales; la categoría mayor en amarillo, las demás en azul marino.
// items: [{ categoria, cantidad, total, porcentaje }] ordenados de mayor a menor
export function barrasCategorias(items) {
    return h('ul', { class: 'categorias' },
        items.map((item, indice) =>
            h('li', null,
                h('div', { class: 'categoria-fila' },
                    h('span', { class: 'categoria-nombre' }, item.categoria),
                    h('span', { class: 'categoria-valor' }, dinero(item.total), h('small', null, ` · ${porcentaje(item.porcentaje)}`))
                ),
                h('div', { class: 'pista', 'aria-hidden': 'true' },
                    h('div', { class: indice === 0 ? 'relleno mayor' : 'relleno', style: `width:${Math.max(item.porcentaje, 1.5)}%` })
                ),
                h('small', { class: 'categoria-cantidad' }, `${item.cantidad} ${item.cantidad === 1 ? 'gasto' : 'gastos'}`)
            )
        )
    );
}

// Resumen: tabla Categoría | Proporción | Total, con una fila Total al final.
export function tablaCategorias(items) {
    const total = items.reduce((suma, item) => suma + Number(item.total), 0);

    return h('div', { class: 'tabla-contenedor' },
        h('table', { class: 'tabla tabla-categorias' },
            h('thead', null, h('tr', null,
                h('th', { scope: 'col' }, 'Categoría'),
                h('th', { scope: 'col' }, 'Proporción'),
                h('th', { scope: 'col', class: 'num' }, 'Total')
            )),
            h('tbody', null,
                items.map((item, indice) => h('tr', null,
                    h('td', null, item.categoria),
                    h('td', null,
                        h('div', { class: 'proporcion' },
                            h('div', { class: 'pista', 'aria-hidden': 'true' },
                                h('div', { class: indice === 0 ? 'relleno mayor' : 'relleno', style: `width:${Math.max(item.porcentaje, 1.5)}%` })
                            ),
                            h('span', null, porcentaje(item.porcentaje))
                        )
                    ),
                    h('td', { class: 'num' }, dinero(item.total))
                )),
                h('tr', { class: 'total' },
                    h('td', null, 'Total'),
                    h('td', null),
                    h('td', { class: 'num gasto' }, dinero(total))
                )
            )
        )
    );
}
