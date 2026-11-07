// Perfil: datos personales, cambio de contraseña y eliminación de la cuenta.

import { h, icono, iniciales, campo, aviso, conEspera, modal } from '../ui.js';
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

    // ---------- Encabezado ----------
    const avatar = h('span', { class: 'avatar avatar-grande', 'aria-hidden': 'true' }, iniciales(usuario.nombre));
    const tituloNombre = h('h2', null, usuario.nombre);
    const textoCorreo = h('p', null, usuario.correo);

    // ---------- Datos ----------
    const nombre = campo({ etiqueta: 'Nombre', nombre: 'nombre', valor: usuario.nombre, maxlength: '100', required: true });
    const correo = campo({ etiqueta: 'Correo', nombre: 'correo', tipo: 'email', valor: usuario.correo, maxlength: '150', required: true });
    const errorDatos = mensajeError();
    const guardarDatos = h('button', { type: 'submit', class: 'btn btn-primario', 'data-testid': 'guardar-perfil' }, 'Guardar cambios');
    const confirmacion = h('p', { class: 'confirmacion', role: 'status', hidden: true }, icono('palomita', { tam: 20 }), 'Cambios guardados');

    const formularioDatos = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-perfil' },
        nombre.nodo, correo.nodo, errorDatos,
        h('div', { class: 'acciones' }, guardarDatos, confirmacion)
    );

    formularioDatos.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        errorDatos.hidden = true;
        confirmacion.hidden = true;

        const cuerpo = { nombre: nombre.entrada.value.trim(), correo: correo.entrada.value.trim() };

        if (!cuerpo.nombre) return mostrar(errorDatos, 'El nombre no puede estar vacío.');
        if (!REGEX_CORREO.test(cuerpo.correo)) return mostrar(errorDatos, 'Escribe un correo válido.');

        try {
            const respuesta = await conEspera(guardarDatos, () => api('/api/usuarios/perfil', { metodo: 'PUT', cuerpo }));

            // El token lleva el correo, así que el servidor entrega uno nuevo.
            sesion.guardar(respuesta.token);
            estado.usuario = respuesta.usuario;
            alActualizarUsuario();

            tituloNombre.textContent = respuesta.usuario.nombre;
            textoCorreo.textContent = respuesta.usuario.correo;
            avatar.textContent = iniciales(respuesta.usuario.nombre);
            confirmacion.hidden = false;
        } catch (fallo) {
            mostrar(errorDatos, fallo.message);
        }
    });

    // ---------- Contraseña ----------
    const actual = campo({ etiqueta: 'Contraseña actual', nombre: 'passwordActual', tipo: 'password', autocomplete: 'current-password', required: true });
    const nueva = campo({ etiqueta: 'Contraseña nueva', nombre: 'passwordNueva', tipo: 'password', autocomplete: 'new-password', required: true, ayuda: `Mínimo ${LARGO_MINIMO_PASSWORD} caracteres.` });
    const repetida = campo({ etiqueta: 'Repite la contraseña nueva', nombre: 'passwordRepetida', tipo: 'password', autocomplete: 'new-password', required: true });
    const errorPassword = mensajeError();
    const guardarPassword = h('button', { type: 'submit', class: 'btn btn-oscuro', 'data-testid': 'guardar-password' }, 'Cambiar contraseña');

    const formularioPassword = h('form', { class: 'formulario', novalidate: true, 'data-testid': 'form-password' },
        actual.nodo, nueva.nodo, repetida.nodo, errorPassword,
        h('div', { class: 'acciones' }, guardarPassword)
    );

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
            h('p', { class: 'modal-texto' }, 'Se borrarán tu cuenta y todos tus ingresos y gastos. Esta acción no se puede deshacer. Escribe tu contraseña para confirmar.'),
            password.nodo,
            error,
            h('div', { class: 'acciones modal-pie' },
                h('button', { type: 'button', class: 'btn btn-texto', onclick: () => ventana.cerrar() }, 'Cancelar'),
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
        h('header', { class: 'perfil-cabecera' },
            avatar,
            h('div', null, tituloNombre, textoCorreo)
        ),
        h('div', { class: 'rejilla-dos' },
            h('section', { class: 'tarjeta', 'aria-labelledby': 'titulo-datos' }, h('h3', { id: 'titulo-datos' }, 'Datos personales'), formularioDatos),
            h('section', { class: 'tarjeta', 'aria-labelledby': 'titulo-password' }, h('h3', { id: 'titulo-password' }, 'Cambiar contraseña'), formularioPassword)
        ),
        h('section', { class: 'tarjeta tarjeta-peligro', 'aria-labelledby': 'titulo-eliminar' },
            h('h3', { id: 'titulo-eliminar' }, 'Eliminar cuenta'),
            h('p', null, 'Se borran de forma permanente tu cuenta, tus ingresos y tus gastos. No se puede deshacer.'),
            h('button', { type: 'button', class: 'btn btn-peligro', 'data-testid': 'eliminar-cuenta', onclick: abrirEliminar }, 'Eliminar mi cuenta')
        )
    );
}
