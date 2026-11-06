// CORS (lista blanca de orígenes) y documentación Swagger.
//
// cy.request() no es un navegador y no envía "Origin" por sí solo, así que aquí se agrega a mano
// para simular lo que haría un navegador desde otra página.

describe('CORS y documentación Swagger', () => {
    const ORIGEN_PROPIO = new URL(Cypress.config('baseUrl')).origin;
    const ORIGEN_AJENO = 'http://sitio-malicioso.com';

    describe('CORS', () => {
        it('un origen NO permitido recibe 403 y ninguna cabecera Access-Control-*', () => {
            cy.request({ url: '/api/saldo', headers: { Origin: ORIGEN_AJENO }, failOnStatusCode: false }).then((respuesta) => {
                expect(respuesta.status).to.eq(403);
                expect(respuesta.body.mensaje).to.include('CORS');
                expect(respuesta.headers).to.not.have.property('access-control-allow-origin');
            });
        });

        it('un origen permitido pasa y recibe Access-Control-Allow-Origin', () => {
            cy.request({ url: '/api/saldo', headers: { Origin: ORIGEN_PROPIO }, failOnStatusCode: false }).then((respuesta) => {
                // 401 porque no lleva token: lo importante es que CORS lo dejó pasar
                expect(respuesta.status).to.eq(401);
                expect(respuesta.headers['access-control-allow-origin']).to.eq(ORIGEN_PROPIO);
                expect(respuesta.headers['access-control-expose-headers']).to.include('X-Cache');
            });
        });

        it('el preflight (OPTIONS) de un origen permitido responde 204 con los métodos permitidos', () => {
            cy.request({
                method: 'OPTIONS',
                url: '/api/ingresos',
                headers: { Origin: ORIGEN_PROPIO, 'Access-Control-Request-Method': 'POST' },
                failOnStatusCode: false
            }).then((respuesta) => {
                expect(respuesta.status).to.eq(204);
                expect(respuesta.headers['access-control-allow-methods']).to.include('POST');
                expect(respuesta.headers['access-control-allow-headers']).to.include('Authorization');
            });
        });

        it('el preflight de un origen NO permitido responde 403', () => {
            cy.request({
                method: 'OPTIONS',
                url: '/api/ingresos',
                headers: { Origin: ORIGEN_AJENO, 'Access-Control-Request-Method': 'POST' },
                failOnStatusCode: false
            }).then((respuesta) => {
                expect(respuesta.status).to.eq(403);
                expect(respuesta.headers).to.not.have.property('access-control-allow-origin');
            });
        });

        it('un origen no permitido tampoco puede iniciar sesión (ruta pública)', () => {
            cy.request({
                method: 'POST',
                url: '/api/usuarios/login',
                headers: { Origin: ORIGEN_AJENO },
                body: { correo: 'a@a.com', password: 'x' },
                failOnStatusCode: false
            }).its('status').should('eq', 403);
        });
    });

    describe('Swagger', () => {
        it('/api-docs entrega la página de Swagger UI', () => {
            cy.request('/api-docs').then((respuesta) => {
                expect(respuesta.status).to.eq(200);
                expect(respuesta.headers['content-type']).to.include('text/html');
                expect(respuesta.body).to.include('swagger-ui');
            });
        });

        it('/api-docs/openapi.json entrega el contrato con las 27 operaciones', () => {
            cy.request('/api-docs/openapi.json').then((respuesta) => {
                expect(respuesta.status).to.eq(200);
                expect(respuesta.body.info.title).to.eq('FinanControl API');

                const total = Object.values(respuesta.body.paths).reduce((suma, metodos) => suma + Object.keys(metodos).length, 0);

                expect(total).to.eq(27);
            });
        });
    });
});
