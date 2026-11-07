// Vista de lista con alta, edición y baja. Sirve tanto para ingresos como para gastos.

import { h, icono, plural, campo, dinero, fechaLarga, hoy, modal, confirmar, aviso, conEspera, cargando, vacio, tarjetaError } from '../ui.js';
import { api, apiLista } from '../api.js';
import { formularioFiltros, paginacion } from './comun.js';

const LIMITE = 10;
// Pastillas de la ventana, en este orden. El campo de texto admite cualquier otra.
const CATEGORIAS_SUGERIDAS = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios', 'Salud', 'Educación', 'Ropa', 'Ocio', 'Otros'];

// config: { ruta, titulo, singular, conCategoria }
export function crearVista(config) {
    const { ruta, titulo, singular, conCategoria } = config;
    const tipo = conCategoria ? 'gasto' : 'ingreso';
    const Singular = `${singular[0].toUpperCase()}${singular.slice(1)}`;

    return {
        async render() {
            let pagina = 1;
            let filtros = {};
            let categoriasUsadas = [];

            if (conCategoria) {
                try {
                    // Llegan ordenadas de mayor a menor gasto: la primera se destaca en la tabla.
                    categoriasUsadas = (await api('/api/gastos/categorias')).map((c) => c.categoria);
                } catch (error) {
                    categoriasUsadas = [];
                }
            }

            const categoriaMayor = categoriasUsadas[0];
            const todasLasCategorias = () => [...new Set([...categoriasUsadas, ...CATEGORIAS_SUGERIDAS])].sort((a, b) => a.localeCompare(b, 'es'));
            const zona = h('div', { class: 'zona-lista', 'aria-live': 'polite' });
            const resumenLista = h('p', { class: 'resumen-lista' });

            const definicionFiltros = [
                { nombre: 'desde', etiqueta: 'Desde', tipo: 'date' },
                { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date' },
                { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Descripción…' }
            ];

            if (conCategoria) {
                definicionFiltros.push({
                    nombre: 'categoria',
                    etiqueta: 'Categoría',
                    tipo: 'select',
                    opciones: [['', 'Todas'], ...todasLasCategorias().map((c) => [c, c])]
                });
            }

            const panelFiltros = formularioFiltros(definicionFiltros, (valores) => {
                filtros = valores;
                pagina = 1;
                cargar();
            });

            // "N gastos · $total en total": el total sale de la misma lista filtrada, sin paginar.
            function pintarResumen(total, items) {
                const suma = items.reduce((acumulado, item) => acumulado + Number(item.valor), 0);

                resumenLista.replaceChildren(
                    `${plural(total, singular)} · `,
                    h('strong', { class: tipo }, dinero(suma)),
                    ' en total'
                );
            }

            async function cargar() {
                zona.replaceChildren(cargando());

                try {
                    const [{ items, total }, todos] = await Promise.all([
                        apiLista(ruta, { consulta: { ...filtros, pagina, limite: LIMITE } }),
                        api(ruta, { consulta: filtros })
                    ]);

                    // Si borraste el último de una página, vuelve a la anterior.
                    if (items.length === 0 && pagina > 1) {
                        pagina -= 1;

                        return cargar();
                    }

                    pintarResumen(total, todos);

                    zona.replaceChildren(
                        items.length === 0
                            ? vacio(
                                Object.values(filtros).some(Boolean) ? 'Sin resultados' : `Aún no hay ${titulo.toLowerCase()}`,
                                Object.values(filtros).some(Boolean)
                                    ? 'Prueba con otros filtros.'
                                    : `Registra tu primer ${singular} con el botón "Nuevo ${singular}".`
                            )
                            : tabla(items),
                        paginacion({ pagina, limite: LIMITE, total, singular, alCambiar: (nueva) => { pagina = nueva; cargar(); } })
                    );
                } catch (error) {
                    zona.replaceChildren(tarjetaError(error, cargar));
                }
            }

            function tabla(items) {
                return h('div', { class: 'tabla-contenedor' },
                    h('table', { class: 'tabla tabla-tarjetas', 'data-testid': 'tabla' },
                        h('thead', null,
                            h('tr', null,
                                h('th', { scope: 'col' }, 'Fecha'),
                                h('th', { scope: 'col' }, 'Descripción'),
                                conCategoria ? h('th', { scope: 'col' }, 'Categoría') : null,
                                h('th', { scope: 'col', class: 'num' }, 'Valor'),
                                h('th', { scope: 'col', class: 'acciones-col' }, h('span', { class: 'solo-lectores' }, 'Acciones'))
                            )
                        ),
                        h('tbody', null,
                            items.map((item) =>
                                h('tr', { 'data-testid': 'fila' },
                                    h('td', { class: 'fecha', 'data-etiqueta': 'Fecha' }, fechaLarga(item.fecha)),
                                    h('td', { class: 'descripcion', 'data-etiqueta': 'Descripción' }, item.descripcion),
                                    conCategoria
                                        ? h('td', { class: 'categoria', 'data-etiqueta': 'Categoría' }, h('span', { class: item.categoria === categoriaMayor ? 'pastilla pastilla-destacada' : 'pastilla pastilla-gris' }, item.categoria))
                                        : null,
                                    // El signo solo se muestra en celular, donde la fila se ve como tarjeta.
                                    h('td', { class: `num celda-valor ${tipo}`, 'data-etiqueta': 'Valor' },
                                        h('span', { class: 'signo-movil' }, tipo === 'gasto' ? '−' : '+'),
                                        dinero(item.valor)
                                    ),
                                    h('td', { class: 'acciones-col' },
                                        h('div', { class: 'acciones-fila' },
                                            h('button', {
                                                type: 'button', class: 'btn-icono', 'data-testid': 'editar',
                                                'aria-label': `Editar ${item.descripcion}`, title: 'Editar', onclick: () => abrirFormulario(item)
                                            }, icono('editar', { tam: 20 })),
                                            h('button', {
                                                type: 'button', class: 'btn-icono peligro', 'data-testid': 'eliminar',
                                                'aria-label': `Eliminar ${item.descripcion}`, title: 'Eliminar', onclick: () => eliminar(item)
                                            }, icono('eliminar', { tam: 20 }))
                                        )
                                    )
                                )
                            )
                        )
                    )
                );
            }

            async function eliminar(item) {
                const acepta = await confirmar(`Se eliminará "${item.descripcion}" (${dinero(item.valor)}). Esta acción no se puede deshacer.`);

                if (!acepta) return;

                try {
                    await api(`${ruta}/${item.id}`, { metodo: 'DELETE' });
                    aviso(`${Singular} eliminado.`);
                    cargar();
                } catch (error) {
                    aviso(error.message, 'error');
                }
            }

            // Pastillas de categoría: solo llenan el campo de texto f-categoria (que sigue siendo el que se envía).
            function pastillasCategoria(entrada) {
                const botones = CATEGORIAS_SUGERIDAS.map((nombre) =>
                    h('button', {
                        type: 'button',
                        class: 'pastilla-opcion',
                        'aria-pressed': 'false',
                        onclick: () => {
                            entrada.value = nombre;
                            sincronizar();
                        }
                    }, nombre)
                );

                function sincronizar() {
                    const escrito = entrada.value.trim().toLocaleLowerCase('es');

                    botones.forEach((boton) => boton.setAttribute('aria-pressed', String(boton.textContent.toLocaleLowerCase('es') === escrito)));
                }

                entrada.addEventListener('input', sincronizar);
                sincronizar();

                return h('div', { class: 'pastillas-opciones', role: 'group', 'aria-label': 'Categorías frecuentes' }, botones);
            }

            function abrirFormulario(item) {
                const editando = Boolean(item);
                const descripcion = campo({ etiqueta: 'Descripción', nombre: 'descripcion', valor: item ? item.descripcion : '', maxlength: '255', required: true });
                const valor = campo({ etiqueta: 'Valor (COP)', nombre: 'valor', tipo: 'number', valor: item ? item.valor : '', min: '0.01', step: 'any', inputmode: 'decimal', required: true, prefijo: '$' });
                const fecha = campo({ etiqueta: 'Fecha', nombre: 'fecha', tipo: 'date', valor: item ? item.fecha : hoy(), required: true });
                const categoria = conCategoria
                    ? campo({ etiqueta: 'Categoría', nombre: 'categoria', valor: item ? item.categoria : '', maxlength: '100', required: true, list: 'lista-categorias', autocomplete: 'off', ayuda: 'Elige una o escribe una nueva.' })
                    : null;

                // Las pastillas van entre la etiqueta y el campo de texto
                if (categoria) categoria.nodo.insertBefore(pastillasCategoria(categoria.entrada), categoria.entrada);

                const error = h('p', { class: 'form-error', role: 'alert', 'data-testid': 'form-error', hidden: true });
                const guardar = h('button', { type: 'submit', class: 'btn btn-primario', 'data-testid': 'f-guardar' }, `Guardar ${singular}`);

                const formulario = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-movimiento' },
                    descripcion.nodo,
                    h('div', { class: 'campos-dos' }, valor.nodo, fecha.nodo),
                    categoria ? [categoria.nodo, h('datalist', { id: 'lista-categorias' }, todasLasCategorias().map((c) => h('option', { value: c })))] : null,
                    error,
                    h('div', { class: 'acciones modal-pie' },
                        h('button', { type: 'button', class: 'btn btn-texto', onclick: () => ventana.cerrar() }, 'Cancelar'),
                        guardar
                    )
                );

                const ventana = modal(`${editando ? 'Editar' : 'Nuevo'} ${singular}`, formulario, {
                    subtitulo: conCategoria ? 'Se resta de tu saldo al guardarlo.' : 'Se suma a tu saldo al guardarlo.'
                });

                formulario.addEventListener('submit', async (evento) => {
                    evento.preventDefault();
                    error.hidden = true;

                    const cuerpo = {
                        descripcion: descripcion.entrada.value.trim(),
                        valor: Number(valor.entrada.value),
                        fecha: fecha.entrada.value
                    };

                    if (conCategoria) cuerpo.categoria = categoria.entrada.value.trim();

                    const problema = validar(cuerpo, conCategoria);

                    if (problema) {
                        error.textContent = problema;
                        error.hidden = false;

                        return;
                    }

                    try {
                        await conEspera(guardar, () =>
                            api(editando ? `${ruta}/${item.id}` : ruta, { metodo: editando ? 'PUT' : 'POST', cuerpo })
                        );

                        if (conCategoria && !categoriasUsadas.includes(cuerpo.categoria)) {
                            categoriasUsadas.push(cuerpo.categoria);
                        }

                        ventana.cerrar();
                        aviso(editando ? 'Cambios guardados.' : `${Singular} registrado.`);
                        cargar();
                    } catch (fallo) {
                        error.textContent = fallo.message;
                        error.hidden = false;
                    }
                });

                descripcion.entrada.focus();
            }

            cargar();

            return h('div', { class: 'vista' },
                h('header', { class: 'vista-cabecera' },
                    h('div', null, h('h2', null, titulo), resumenLista),
                    h('button', { type: 'button', class: 'btn btn-primario', 'data-testid': 'btn-nuevo', onclick: () => abrirFormulario(null) },
                        icono('mas'), `Nuevo ${singular}`)
                ),
                h('section', { class: 'tarjeta', 'aria-label': 'Filtros' }, panelFiltros.nodo),
                h('section', { class: 'tarjeta sin-relleno', 'aria-label': `Lista de ${titulo.toLowerCase()}` }, zona)
            );
        }
    };
}

function validar({ descripcion, valor, fecha, categoria }, conCategoria) {
    if (!descripcion) return 'Escribe una descripción.';
    if (conCategoria && !categoria) return 'Escribe o elige una categoría.';
    if (!Number.isFinite(valor) || valor <= 0) return 'El valor debe ser mayor que 0.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return 'Elige una fecha válida.';

    return null;
}
