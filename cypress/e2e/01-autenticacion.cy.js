const { PASSWORD, crearUsuario, eliminarUsuario, conAuth } = require('../support/api');

describe('Autenticación y cuenta de usuario', () => {
    let usuario;

    before(() => {
        crearUsuario('auth').then((u) => {
            usuario = u;
        });
    });

    after(() => {
        eliminarUsuario(usuario);
    });

    it('la API está funcionando y conectada a la base de datos', () => {
        cy.request('/').then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body).to.deep.include({ mensaje: 'API FinanControl funcionando', baseDatos: 'Conectada' });
        });
    });

    it('rechaza el registro con campos faltantes', () => {
        cy.request({ method: 'POST', url: '/api/usuarios/registro', body: { correo: 'x@financontrol.test' }, failOnStatusCode: false })
            .then((respuesta) => {
                expect(respuesta.status).to.eq(400);
                expect(respuesta.body.mensaje).to.eq('Todos los campos son obligatorios');
            });
    });

    it('rechaza registrar un correo que ya existe', () => {
        cy.request({
            method: 'POST',
            url: '/api/usuarios/registro',
            body: { nombre: 'Repetido', correo: usuario.correo, password: PASSWORD },
            failOnStatusCode: false
        }).then((respuesta) => {
            expect(respuesta.status).to.eq(400);
            expect(respuesta.body.mensaje).to.eq('El correo ya está registrado');
        });
    });

    it('rechaza el login con contraseña incorrecta', () => {
        cy.request({ method: 'POST', url: '/api/usuarios/login', body: { correo: usuario.correo, password: 'incorrecta' }, failOnStatusCode: false })
            .then((respuesta) => {
                expect(respuesta.status).to.eq(401);
                expect(respuesta.body).to.not.have.property('token');
            });
    });

    it('el token permite entrar a una ruta protegida', () => {
        conAuth(usuario, { url: '/api/prueba-seguridad' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body.usuario.correo).to.eq(usuario.correo);
        });
    });

    it('sin token o con un token falso responde 401', () => {
        cy.request({ url: '/api/saldo', failOnStatusCode: false }).its('status').should('eq', 401);
        cy.request({ url: '/api/saldo', headers: { Authorization: 'Bearer falso' }, failOnStatusCode: false })
            .its('status')
            .should('eq', 401);
    });

    it('consulta y edita el perfil', () => {
        conAuth(usuario, { url: '/api/usuarios/perfil' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body.correo).to.eq(usuario.correo);
            expect(respuesta.body).to.not.have.property('password');
        });

        conAuth(usuario, { method: 'PUT', url: '/api/usuarios/perfil', body: { nombre: 'Nombre Editado' } }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body.usuario.nombre).to.eq('Nombre Editado');
            expect(respuesta.body.token).to.be.a('string');
        });
    });

    it('cambia la contraseña: la anterior deja de servir y la nueva funciona', () => {
        const nueva = 'Clave-Nueva-Cy-2';

        conAuth(usuario, { method: 'PUT', url: '/api/usuarios/password', body: { passwordActual: PASSWORD, passwordNueva: nueva } })
            .its('status')
            .should('eq', 200);

        cy.request({ method: 'POST', url: '/api/usuarios/login', body: { correo: usuario.correo, password: PASSWORD }, failOnStatusCode: false })
            .its('status')
            .should('eq', 401);

        cy.request('POST', '/api/usuarios/login', { correo: usuario.correo, password: nueva })
            .its('status')
            .should('eq', 200)
            .then(() => {
                usuario.password = nueva; // para que after() pueda eliminar la cuenta
            });
    });

    it('eliminar la cuenta exige la contraseña correcta', () => {
        conAuth(usuario, { method: 'DELETE', url: '/api/usuarios/cuenta', body: { password: 'equivocada' } })
            .its('status')
            .should('eq', 401);
    });
});
