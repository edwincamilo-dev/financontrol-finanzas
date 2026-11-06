// Funciones de ayuda para las pruebas E2E de la API de FinanControl.

const PASSWORD = 'Clave-Cypress-1';

function sufijoUnico() {
    return `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
}

// Crea un usuario de prueba nuevo, inicia sesión y devuelve { correo, password, token, headers }.
// Cada especificación usa su propio usuario para no depender de datos previos ni del orden.
function crearUsuario(etiqueta) {
    const correo = `qa.cy.${etiqueta}.${sufijoUnico()}@financontrol.test`;

    return cy
        .request('POST', '/api/usuarios/registro', { nombre: 'QA Cypress', correo, password: PASSWORD })
        .then(() => cy.request('POST', '/api/usuarios/login', { correo, password: PASSWORD }))
        .then((respuesta) => ({
            correo,
            password: PASSWORD,
            token: respuesta.body.token,
            headers: { Authorization: `Bearer ${respuesta.body.token}` }
        }));
}

// Elimina el usuario de prueba y todos sus datos (se usa en after()).
function eliminarUsuario(usuario) {
    return cy.request({
        method: 'DELETE',
        url: '/api/usuarios/cuenta',
        headers: usuario.headers,
        body: { password: usuario.password },
        failOnStatusCode: false
    });
}

function conAuth(usuario, opciones) {
    return cy.request({ headers: usuario.headers, failOnStatusCode: false, ...opciones });
}

module.exports = { PASSWORD, crearUsuario, eliminarUsuario, conAuth };
