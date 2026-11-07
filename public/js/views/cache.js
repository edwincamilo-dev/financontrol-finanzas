// Caché: estadísticas y una prueba en vivo de MISS / HIT (útil para explicar cómo funciona).

import { h, aviso, conEspera, cargando, tarjetaError } from '../ui.js';
import { api, apiMedida } from '../api.js';

function dato(titulo, valor, testid) {
    return h('article', { class: 'tarjeta' }, h('h3', { class: 'etiqueta-tarjeta' }, titulo), h('p', { class: 'valor', 'data-testid': testid }, String(valor)));
}

export async function render() {
    const zonaEstadisticas = h('div', { 'aria-live': 'polite' });
    const zonaPrueba = h('div', { 'aria-live': 'polite' });

    async function cargarEstadisticas() {
        zonaEstadisticas.replaceChildren(cargando());

        try {
            const e = await api('/api/cache/estadisticas');

            zonaEstadisticas.replaceChildren(
                h('div', { class: 'tarjetas tarjetas-cache' },
                    dato('Estado', e.activo ? 'Activo' : 'Desactivado', 'cache-activo'),
                    dato('Entradas guardadas', e.entradas, 'cache-entradas'),
                    dato('Aciertos (HIT)', e.hits, 'cache-hits'),
                    dato('Fallos (MISS)', e.misses, 'cache-misses'),
                    dato('Invalidaciones', e.invalidaciones, 'cache-invalidaciones'),
                    dato('Tasa de acierto', `${e.tasaAcierto}%`, 'cache-tasa')
                )
            );
        } catch (error) {
            zonaEstadisticas.replaceChildren(tarjetaError(error, cargarEstadisticas));
        }
    }

    const botonVaciar = h('button', { type: 'button', class: 'btn btn-borde', 'data-testid': 'vaciar-cache' }, 'Vaciar mi caché');

    botonVaciar.addEventListener('click', () =>
        conEspera(botonVaciar, async () => {
            try {
                const r = await api('/api/cache', { metodo: 'DELETE' });

                aviso(`Caché vaciado (${r.entradasEliminadas} ${r.entradasEliminadas === 1 ? 'entrada' : 'entradas'}).`);
                await cargarEstadisticas();
            } catch (error) {
                aviso(error.message, 'error');
            }
        })
    );

    const botonProbar = h('button', { type: 'button', class: 'btn btn-primario', 'data-testid': 'probar-cache' }, 'Consultar el saldo 3 veces');

    botonProbar.addEventListener('click', () =>
        conEspera(botonProbar, async () => {
            const filas = [];

            try {
                for (let intento = 1; intento <= 3; intento++) {
                    const r = await apiMedida('/api/saldo');

                    filas.push(h('tr', { 'data-testid': 'prueba-fila' },
                        h('td', null, intento),
                        h('td', null, h('span', { class: `insignia insignia-cache-${r.cache.toLowerCase()}` }, r.cache)),
                        h('td', { class: 'num' }, `${r.milisegundos.toFixed(1)} ms`)
                    ));
                }

                zonaPrueba.replaceChildren(
                    h('div', { class: 'tabla-contenedor' },
                        h('table', { class: 'tabla' },
                            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Consulta'), h('th', { scope: 'col' }, 'X-Cache'), h('th', { scope: 'col', class: 'num' }, 'Tiempo'))),
                            h('tbody', null, filas)
                        )
                    ),
                    h('p', { class: 'nota' }, 'Si el saldo ya estaba guardado, las tres salen HIT. Tras vaciar el caché o crear/editar/borrar datos, la primera vuelve a ser MISS.')
                );

                await cargarEstadisticas();
            } catch (error) {
                aviso(error.message, 'error');
            }
        })
    );

    cargarEstadisticas();

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera' },
            h('div', null, h('h2', null, 'Caché'), h('p', { class: 'sub' }, 'Las consultas GET se guardan en memoria por usuario y se invalidan al crear, editar o borrar datos.')),
            h('div', { class: 'acciones' }, botonVaciar)
        ),
        zonaEstadisticas,
        h('section', { class: 'tarjeta' },
            h('div', { class: 'tarjeta-cabecera' }, h('h3', null, 'Prueba en vivo'), botonProbar),
            h('p', { class: 'nota' }, 'Cada respuesta de la API trae la cabecera X-Cache: MISS (fue a la base de datos) o HIT (salió de memoria).'),
            zonaPrueba
        )
    );
}
