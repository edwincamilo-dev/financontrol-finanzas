const { crearUsuario, eliminarUsuario, conAuth } = require('../support/api');

// Pruebas de contrato sobre docs/openapi.json
describe('Contrato de la API (OpenAPI)', () => {
    let contrato;
    let usuario;

    before(() => {
        cy.readFile('docs/openapi.json').then((c) => {
            contrato = c;
        });

        crearUsuario('contrato').then((u) => {
            usuario = u;
        });
    });

    after(() => {
        eliminarUsuario(usuario);
    });

    it('el contrato documenta las 27 operaciones de la API', () => {
        const total = Object.values(contrato.paths).reduce((suma, operaciones) => suma + Object.keys(operaciones).length, 0);

        expect(total).to.eq(27);
    });

    it('toda ruta protegida rechaza las peticiones sin token con 401', () => {
        const protegidas = [];

        Object.entries(contrato.paths).forEach(([ruta, operaciones]) => {
            Object.entries(operaciones).forEach(([metodo, operacion]) => {
                if (operacion.security) {
                    protegidas.push({ metodo: metodo.toUpperCase(), url: ruta.replace('{id}', '1').replace('{categoria}', 'x') });
                }
            });
        });

        expect(protegidas.length).to.be.greaterThan(20);

        protegidas.forEach(({ metodo, url }) => {
            cy.request({ method: metodo, url, failOnStatusCode: false })
                .its('status')
                .should('eq', 401);
        });
    });

    it('las respuestas traen los campos que exige el contrato', () => {
        const rutas = [
            { url: '/api/saldo', esquema: 'Saldo' },
            { url: '/api/usuarios/perfil', esquema: 'Perfil' },
            { url: '/api/resumen', esquema: 'Resumen' },
            { url: '/api/resumen/mensual?anio=2026', esquema: 'ResumenMensual' },
            { url: '/api/cache/estadisticas', esquema: 'EstadisticasCache' }
        ];

        rutas.forEach(({ url, esquema }) => {
            conAuth(usuario, { url }).then((respuesta) => {
                expect(respuesta.status).to.eq(200);

                contrato.components.schemas[esquema].required.forEach((campo) => {
                    expect(respuesta.body, `${url} debe incluir "${campo}"`).to.have.property(campo);
                });
            });
        });
    });

    it('un ingreso creado cumple el esquema de Ingreso', () => {
        conAuth(usuario, { method: 'POST', url: '/api/ingresos', body: { descripcion: 'Contrato', valor: 100, fecha: '2026-10-01' } })
            .then((creado) => {
                expect(creado.status).to.eq(201);

                conAuth(usuario, { url: `/api/ingresos/${creado.body.id}` }).then((respuesta) => {
                    contrato.components.schemas.Ingreso.required.forEach((campo) => {
                        expect(respuesta.body).to.have.property(campo);
                    });

                    expect(respuesta.body.valor).to.be.a('number');
                    expect(respuesta.body.fecha).to.match(/^\d{4}-\d{2}-\d{2}$/);
                });
            });
    });
});
