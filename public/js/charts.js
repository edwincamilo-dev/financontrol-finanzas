// Gráficas sin librerías: SVG para las barras mensuales y HTML para las categorías.

import { h, dinero, dineroCompacto } from './ui.js';

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

// meses: [{ nombre, ingresos, gastos, saldo }] (12 elementos)
export function barrasMensuales(meses) {
    const ancho = 520;
    const alto = 300;
    const margen = { izquierda: 50, derecha: 8, arriba: 12, abajo: 30 };
    const areaAncho = ancho - margen.izquierda - margen.derecha;
    const areaAlto = alto - margen.arriba - margen.abajo;
    const maximo = maximoLimpio(Math.max(...meses.flatMap((m) => [m.ingresos, m.gastos])));
    const grupo = areaAncho / meses.length;
    const barra = Math.min(grupo * 0.32, 22);
    const escala = (valor) => (valor / maximo) * areaAlto;

    const svg = s('svg', {
        viewBox: `0 0 ${ancho} ${alto}`,
        class: 'grafica',
        role: 'img',
        'aria-label': 'Ingresos y gastos por mes'
    });

    for (let i = 0; i <= 4; i++) {
        const valor = (maximo / 4) * i;
        const y = margen.arriba + areaAlto - escala(valor);

        svg.append(
            s('line', { x1: margen.izquierda, x2: ancho - margen.derecha, y1: y, y2: y, class: 'guia' }),
            s('text', { x: margen.izquierda - 8, y: y + 4, class: 'eje', 'text-anchor': 'end' }, dineroCompacto(valor))
        );
    }

    meses.forEach((mes, indice) => {
        const x0 = margen.izquierda + grupo * indice + (grupo - barra * 2 - 3) / 2;
        const base = margen.arriba + areaAlto;
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
                y: alto - 10,
                class: 'eje',
                'text-anchor': 'middle'
            }, mes.nombre.slice(0, 3))
        );
    });

    return h('figure', { class: 'figura' },
        svg,
        h('figcaption', { class: 'leyenda' },
            h('span', null, h('i', { class: 'punto punto-ingreso' }), 'Ingresos'),
            h('span', null, h('i', { class: 'punto punto-gasto' }), 'Gastos')
        )
    );
}

// items: [{ categoria, cantidad, total, porcentaje }]
export function barrasCategorias(items) {
    return h('ul', { class: 'categorias' },
        items.map((item) =>
            h('li', null,
                h('div', { class: 'categoria-fila' },
                    h('span', { class: 'categoria-nombre' }, item.categoria),
                    h('span', { class: 'categoria-valor' }, dinero(item.total), h('small', null, ` · ${item.porcentaje}%`))
                ),
                h('div', { class: 'pista', role: 'presentation' },
                    h('div', { class: 'relleno', style: `width:${Math.max(item.porcentaje, 1.5)}%` })
                ),
                h('small', { class: 'categoria-cantidad' }, `${item.cantidad} ${item.cantidad === 1 ? 'gasto' : 'gastos'}`)
            )
        )
    );
}
