// Pantalla de acceso: iniciar sesión o crear cuenta.

import { h, campo, conEspera } from '../ui.js';
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

    return h('main', { class: 'auth' },
        // Portada decorativa (solo visual, oculta a lectores de pantalla).
        h('div', { class: 'auth-hero', 'aria-hidden': 'true' },
            h('p', { class: 'auth-kicker' }, 'Libro mayor personal · COP'),
            h('p', { class: 'auth-titular' }, 'Cada peso,', h('br'), h('span', { class: 'tachado' }, 'perdido'), h('br'), h('em', null, 'bajo control.')),
            h('ul', { class: 'auth-cinta' }, h('li', null, '+ Ingresos'), h('li', null, '− Gastos'), h('li', null, '= Saldo'))
        ),
        h('section', { class: 'auth-tarjeta' },
            h('div', { class: 'marca' },
                h('span', { class: 'logo', 'aria-hidden': 'true' }, '$'),
                h('div', null, h('h1', null, 'FinanControl'), h('p', null, 'Tus finanzas, bajo control.'))
            ),
            avisoPrevio ? h('p', { class: 'aviso-info', role: 'status' }, avisoPrevio) : null,
            h('div', { class: 'pestanas', role: 'tablist' },
                h('a', { href: '#/login', role: 'tab', 'aria-selected': String(!esRegistro), 'data-testid': 'tab-login' }, 'Iniciar sesión'),
                h('a', { href: '#/registro', role: 'tab', 'aria-selected': String(esRegistro), 'data-testid': 'tab-registro' }, 'Crear cuenta')
            ),
            formulario
        ),
        h('p', { class: 'auth-pie' }, h('a', { href: '/api-docs', target: '_blank', rel: 'noopener' }, 'Documentación de la API (Swagger)'))
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
