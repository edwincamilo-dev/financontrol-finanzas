// Perfil: datos personales, cambio de contraseña y eliminación de la cuenta.

import { h, campo, aviso, conEspera, modal } from '../ui.js';
import { api, sesion } from '../api.js';

const LARGO_MINIMO_PASSWORD = 6;
const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mensajeError() {
    return h('p', { class: 'form-error', role: 'alert', hidden: true });
}

function mostrar(nodo, texto) {
    nodo.textContent = texto;
    nodo.hidden = false;
}

export async function render({ estado, alCerrarSesion, alActualizarUsuario }) {
    const usuario = await api('/api/usuarios/perfil');

    estado.usuario = usuario;

    // ---------- Datos ----------
    const nombre = campo({ etiqueta: 'Nombre', nombre: 'nombre', valor: usuario.nombre, maxlength: '100', required: true });
    const correo = campo({ etiqueta: 'Correo', nombre: 'correo', tipo: 'email', valor: usuario.correo, maxlength: '150', required: true });
    const errorDatos = mensajeError();
    const guardarDatos = h('button', { type: 'submit', class: 'btn btn-primario', 'data-testid': 'guardar-perfil' }, 'Guardar cambios');

    const formularioDatos = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-perfil' }, nombre.nodo, correo.nodo, errorDatos, guardarDatos);

    formularioDatos.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        errorDatos.hidden = true;

        const cuerpo = { nombre: nombre.entrada.value.trim(), correo: correo.entrada.value.trim() };

        if (!cuerpo.nombre) return mostrar(errorDatos, 'El nombre no puede estar vacío.');
        if (!REGEX_CORREO.test(cuerpo.correo)) return mostrar(errorDatos, 'Escribe un correo válido.');

        try {
            const respuesta = await conEspera(guardarDatos, () => api('/api/usuarios/perfil', { metodo: 'PUT', cuerpo }));

            // El token lleva el correo, así que el servidor entrega uno nuevo.
            sesion.guardar(respuesta.token);
            estado.usuario = respuesta.usuario;
            alActualizarUsuario();
            aviso('Perfil actualizado.');
        } catch (fallo) {
            mostrar(errorDatos, fallo.message);
        }
    });

    // ---------- Contraseña ----------
    const actual = campo({ etiqueta: 'Contraseña actual', nombre: 'passwordActual', tipo: 'password', autocomplete: 'current-password', required: true });
    const nueva = campo({ etiqueta: 'Contraseña nueva', nombre: 'passwordNueva', tipo: 'password', autocomplete: 'new-password', required: true, ayuda: `Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.` });
    const repetida = campo({ etiqueta: 'Repite la contraseña nueva', nombre: 'passwordRepetida', tipo: 'password', autocomplete: 'new-password', required: true });
    const errorPassword = mensajeError();
    const guardarPassword = h('button', { type: 'submit', class: 'btn btn-primario', 'data-testid': 'guardar-password' }, 'Cambiar contraseña');

    const formularioPassword = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-password' },
        actual.nodo, nueva.nodo, repetida.nodo, errorPassword, guardarPassword);

    formularioPassword.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        errorPassword.hidden = true;

        if (!actual.entrada.value || !nueva.entrada.value) return mostrar(errorPassword, 'Completa las contraseñas.');
        if (nueva.entrada.value.length < LARGO_MINIMO_PASSWORD) return mostrar(errorPassword, `La nueva contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres.`);
        if (nueva.entrada.value !== repetida.entrada.value) return mostrar(errorPassword, 'Las contraseñas nuevas no coinciden.');

        try {
            await conEspera(guardarPassword, () => api('/api/usuarios/password', {
                metodo: 'PUT',
                confirmaPassword: true,
                cuerpo: { passwordActual: actual.entrada.value, passwordNueva: nueva.entrada.value }
            }));

            formularioPassword.reset();
            aviso('Contraseña actualizada.');
        } catch (fallo) {
            mostrar(errorPassword, fallo.message);
        }
    });

    // ---------- Eliminar cuenta ----------
    function abrirEliminar() {
        const password = campo({ etiqueta: 'Tu contraseña', nombre: 'password', tipo: 'password', autocomplete: 'current-password', required: true });
        const error = mensajeError();
        const eliminar = h('button', { type: 'submit', class: 'btn btn-peligro', 'data-testid': 'eliminar-cuenta-confirmar' }, 'Eliminar mi cuenta');

        const formulario = h('form', { class: 'formulario', novalidate: true },
            h('p', null, 'Se borrarán tu cuenta y todos tus ingresos y gastos. Esta acción no se puede deshacer. Escribe tu contraseña para confirmar.'),
            password.nodo,
            error,
            h('div', { class: 'acciones' },
                h('button', { type: 'button', class: 'btn btn-secundario', onclick: () => ventana.cerrar() }, 'Cancelar'),
                eliminar
            )
        );

        const ventana = modal('Eliminar cuenta', formulario);

        formulario.addEventListener('submit', async (evento) => {
            evento.preventDefault();
            error.hidden = true;

            if (!password.entrada.value) return mostrar(error, 'Escribe tu contraseña.');

            try {
                await conEspera(eliminar, () => api('/api/usuarios/cuenta', { metodo: 'DELETE', confirmaPassword: true, cuerpo: { password: password.entrada.value } }));
                ventana.cerrar();
                aviso('Tu cuenta fue eliminada.');
                alCerrarSesion();
            } catch (fallo) {
                mostrar(error, fallo.message);
            }
        });

        password.entrada.focus();
    }

    return h('div', { class: 'vista' },
        h('header', { class: 'vista-cabecera' },
            h('div', null, h('h2', null, 'Perfil'), h('p', { class: 'sub' }, 'Administra tus datos y tu seguridad.'))
        ),
        h('div', { class: 'rejilla-dos' },
            h('section', { class: 'tarjeta' }, h('h3', null, 'Datos personales'), formularioDatos),
            h('section', { class: 'tarjeta' }, h('h3', null, 'Cambiar contraseña'), formularioPassword)
        ),
        h('section', { class: 'tarjeta peligro-zona' },
            h('h3', null, 'Zona de peligro'),
            h('p', null, 'Eliminar tu cuenta borra de forma permanente todos tus datos.'),
            h('button', { type: 'button', class: 'btn btn-peligro-borde', 'data-testid': 'eliminar-cuenta', onclick: abrirEliminar }, 'Eliminar cuenta…')
        )
    );
}
