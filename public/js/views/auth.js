// Pantalla de acceso: iniciar sesión o crear cuenta.

import { h, icono, campo, conEspera } from '../ui.js';
import { api, sesion, tomarAviso } from '../api.js';

const LARGO_MINIMO_PASSWORD = 6;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function render(modo, { alEntrar }) {
    const esRegistro = modo === 'registro';
    const avisoPrevio = tomarAviso();

    const error = h('p', { class: 'form-error', role: 'alert', 'data-testid': 'auth-error', hidden: true });
    const nombre = campo({ etiqueta: 'Nombre', nombre: 'nombre', autocomplete: 'name', required: true, 'data-auth': 'nombre' });
    const correo = campo({ etiqueta: 'Correo', nombre: 'correo', tipo: 'email', autocomplete: 'email', required: true });
    const password = campo({
        etiqueta: 'Contraseña',
        nombre: 'password',
        tipo: 'password',
        autocomplete: esRegistro ? 'new-password' : 'current-password',
        required: true,
        ayuda: esRegistro ? `Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.` : null
    });

    const boton = h('button', { type: 'submit', class: 'btn btn-primario ancho', 'data-testid': 'auth-enviar' },
        esRegistro ? 'Crear cuenta' : 'Entrar'
    );

    const formulario = h('form', { class: 'formulario', novalidate: true, 'data-testid': esRegistro ? 'form-registro' : 'form-login' },
        esRegistro ? nombre.nodo : null,
        correo.nodo,
        password.nodo,
        error,
        boton
    );

    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        error.hidden = true;

        const datos = {
            nombre: nombre.entrada.value.trim(),
            correo: correo.entrada.value.trim(),
            password: password.entrada.value
        };

        const problema = validar(datos, esRegistro);

        if (problema) {
            error.textContent = problema;
            error.hidden = false;

            return;
        }

        try {
            await conEspera(boton, async () => {
                if (esRegistro) {
                    await api('/api/usuarios/registro', { metodo: 'POST', cuerpo: datos });
                }

                const respuesta = await api('/api/usuarios/login', {
                    metodo: 'POST',
                    cuerpo: { correo: datos.correo, password: datos.password }
                });

                sesion.guardar(respuesta.token);
                alEntrar();
            });
        } catch (fallo) {
            error.textContent = fallo.message;
            error.hidden = false;
        }
    });

    const BENEFICIOS = ['Ingresos y gastos por categoría', 'Resumen mes a mes', 'Exporta tus movimientos a CSV'];

    return h('div', { class: 'acceso' },
        // Mismo encabezado que la portada
        h('header', { class: 'acceso-cabecera' },
            h('div', { class: 'landing-contenedor landing-fila' },
                h('a', { class: 'landing-marca', href: '#/inicio', 'aria-label': 'FinanControl, inicio' },
                    h('span', { class: 'landing-logo', 'aria-hidden': 'true' }),
                    h('span', null, 'FinanControl')
                ),
                h('a', { class: 'enlace-volver', href: '#/inicio' }, icono('volver'), 'Volver al inicio')
            )
        ),
        h('main', { class: 'acceso-cuerpo landing-contenedor' },
            h('section', { class: 'acceso-texto', 'aria-labelledby': 'acceso-titulo' },
                h('h1', { id: 'acceso-titulo' }, 'Tu libreta te espera en blanco.'),
                h('span', { class: 'landing-barra', 'aria-hidden': 'true' }),
                h('p', null, esRegistro
                    ? 'Crea tu cuenta gratis y empieza a anotar lo que entra y lo que sale. Solo toma un minuto.'
                    : 'Entra para seguir anotando tus movimientos y ver cuánto te queda este mes.'),
                h('ul', { class: 'beneficios' },
                    BENEFICIOS.map((texto) => h('li', null, icono('palomita', { tam: 22 }), texto))
                )
            ),
            h('div', { class: 'acceso-columna' },
                h('section', { class: 'tarjeta acceso-tarjeta', 'aria-labelledby': 'acceso-formulario' },
                    h('span', { class: 'cinta', 'aria-hidden': 'true' }),
                    h('h2', { id: 'acceso-formulario', class: 'solo-lectores' }, esRegistro ? 'Crear cuenta' : 'Iniciar sesión'),
                    avisoPrevio ? h('p', { class: 'aviso-info', role: 'status' }, avisoPrevio) : null,
                    h('div', { class: 'segmentado pestanas', role: 'tablist', 'aria-label': 'Tipo de acceso' },
                        h('a', { href: '#/login', role: 'tab', 'aria-selected': String(!esRegistro), 'data-testid': 'tab-login' }, 'Iniciar sesión'),
                        h('a', { href: '#/registro', role: 'tab', 'aria-selected': String(esRegistro), 'data-testid': 'tab-registro' }, 'Crear cuenta')
                    ),
                    formulario
                ),
                h('p', { class: 'acceso-pie' },
                    '¿Eres desarrollador? ',
                    h('a', { href: '/api-docs', target: '_blank', rel: 'noopener' }, 'Documentación de la API',
                        h('span', { class: 'solo-lectores' }, ' (se abre en otra pestaña)'))
                )
            )
        )
    );
}

function validar({ nombre, correo, password }, esRegistro) {
    if (esRegistro && !nombre) return 'Escribe tu nombre.';
    if (!correo || !REGEX_CORREO.test(correo)) return 'Escribe un correo válido.';
    if (!password) return 'Escribe tu contraseña.';
    if (esRegistro && password.length < LARGO_MINIMO_PASSWORD) {
        return `La contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`;
    }

    return null;
}
