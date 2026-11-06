// Vista de lista con alta, edición y baja. Sirve tanto para ingresos como para gastos.

import { h, campo, dinero, fechaLarga, hoy, modal, confirmar, aviso, conEspera, cargando, vacio, tarjetaError } from '../ui.js';
import { api, apiLista } from '../api.js';
import { formularioFiltros, paginacion } from './comun.js';

const LIMITE = 10;
const CATEGORIAS_SUGERIDAS = ['Alimentación', 'Transporte', 'Vivienda', 'Servicios', 'Salud', 'Educación', 'Ocio', 'Ropa', 'Otros'];

// config: { ruta, titulo, singular, conCategoria }
export function crearVista(config) {
    const { ruta, titulo, singular, conCategoria } = config;

    return {
        async render() {
            let pagina = 1;
            let filtros = {};
            let categoriasUsadas = [];

            if (conCategoria) {
                try {
                    categoriasUsadas = (await api('/api/gastos/categorias')).map((c) => c.categoria);
                } catch (error) {
                    categoriasUsadas = [];
                }
            }

            const todasLasCategorias = () => [...new Set([...categoriasUsadas, ...CATEGORIAS_SUGERIDAS])].sort((a, b) => a.localeCompare(b, 'es'));
            const zona = h('div', { class: 'zona-lista', 'aria-live': 'polite' });

            const definicionFiltros = [
                { nombre: 'buscar', etiqueta: 'Buscar', placeholder: 'Descripción…' },
                { nombre: 'desde', etiqueta: 'Desde', tipo: 'date' },
                { nombre: 'hasta', etiqueta: 'Hasta', tipo: 'date' }
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

            async function cargar() {
                zona.replaceChildren(cargando());

                try {
                    const { items, total } = await apiLista(ruta, { consulta: { ...filtros, pagina, limite: LIMITE } });

                    // Si borraste el último de una página, vuelve a la anterior.
                    if (items.length === 0 && pagina > 1) {
                        pagina -= 1;

                        return cargar();
                    }

                    zona.replaceChildren(
                        items.length === 0
                            ? vacio(
                                Object.values(filtros).some(Boolean) ? 'Sin resultados' : `Aún no hay ${titulo.toLowerCase()}`,
                                Object.values(filtros).some(Boolean)
                                    ? 'Prueba con otros filtros.'
                                    : `Registra tu primer ${singular} con el botón "Nuevo ${singular}".`
                            )
                            : tabla(items),
                        paginacion({ pagina, limite: LIMITE, total, alCambiar: (nueva) => { pagina = nueva; cargar(); } })
                    );
                } catch (error) {
                    zona.replaceChildren(tarjetaError(error, cargar));
                }
            }

            function tabla(items) {
                return h('div', { class: 'tabla-contenedor' },
                    h('table', { class: 'tabla', 'data-testid': 'tabla' },
                        h('thead', null,
                            h('tr', null,
                                h('th', null, 'Fecha'),
                                h('th', null, 'Descripción'),
                                conCategoria ? h('th', null, 'Categoría') : null,
                                h('th', { class: 'num' }, 'Valor'),
                                h('th', { class: 'acciones-col' }, h('span', { class: 'solo-lectores' }, 'Acciones'))
                            )
                        ),
                        h('tbody', null,
                            items.map((item) =>
                                h('tr', { 'data-testid': 'fila' },
                                    h('td', null, fechaLarga(item.fecha)),
                                    h('td', null, item.descripcion),
                                    conCategoria ? h('td', null, h('span', { class: 'etiqueta' }, item.categoria)) : null,
                                    h('td', { class: `num ${conCategoria ? 'gasto' : 'ingreso'}` }, dinero(item.valor)),
                                    h('td', { class: 'acciones-col' },
                                        h('button', { type: 'button', class: 'btn btn-texto', 'data-testid': 'editar', onclick: () => abrirFormulario(item) }, 'Editar'),
                                        h('button', { type: 'button', class: 'btn btn-texto peligro', 'data-testid': 'eliminar', onclick: () => eliminar(item) }, 'Eliminar')
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
                    aviso(`${singular[0].toUpperCase()}${singular.slice(1)} eliminado.`);
                    cargar();
                } catch (error) {
                    aviso(error.message, 'error');
                }
            }

            function abrirFormulario(item) {
                const editando = Boolean(item);
                const descripcion = campo({ etiqueta: 'Descripción', nombre: 'descripcion', valor: item ? item.descripcion : '', maxlength: '255', required: true });
                const valor = campo({ etiqueta: 'Valor (COP)', nombre: 'valor', tipo: 'number', valor: item ? item.valor : '', min: '0.01', step: 'any', inputmode: 'decimal', required: true });
                const fecha = campo({ etiqueta: 'Fecha', nombre: 'fecha', tipo: 'date', valor: item ? item.fecha : hoy(), required: true });
                const categoria = conCategoria
                    ? campo({ etiqueta: 'Categoría', nombre: 'categoria', valor: item ? item.categoria : '', maxlength: '100', required: true, list: 'lista-categorias', autocomplete: 'off', ayuda: 'Elige una o escribe una nueva.' })
                    : null;

                const error = h('p', { class: 'form-error', role: 'alert', 'data-testid': 'form-error', hidden: true });
                const guardar = h('button', { type: 'submit', class: 'btn btn-primario', 'data-testid': 'f-guardar' }, editando ? 'Guardar cambios' : 'Guardar');

                const formulario = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-movimiento' },
                    descripcion.nodo,
                    valor.nodo,
                    categoria ? [categoria.nodo, h('datalist', { id: 'lista-categorias' }, todasLasCategorias().map((c) => h('option', { value: c })))] : null,
                    fecha.nodo,
                    error,
                    h('div', { class: 'acciones' },
                        h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
                        guardar
                    )
                );

                const ventana = modal(`${editando ? 'Editar' : 'Nuevo'} ${singular}`, formulario);

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
                        aviso(editando ? 'Cambios guardados.' : `${singular[0].toUpperCase()}${singular.slice(1)} registrado.`);
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
                    h('div', null, h('h2', null, titulo), h('p', { class: 'sub' }, `Registra, edita y consulta tus ${titulo.toLowerCase()}.`)),
                    h('button', { type: 'button', class: 'btn btn-primario', 'data-testid': 'btn-nuevo', onclick: () => abrirFormulario(null) }, `+ Nuevo ${singular}`)
                ),
                h('section', { class: 'tarjeta' }, panelFiltros.nodo),
                h('section', { class: 'tarjeta sin-relleno' }, zona)
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
