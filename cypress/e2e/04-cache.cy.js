const { crearUsuario, eliminarUsuario, conAuth } = require('../support/api');

describe('Caché de las consultas (MISS, HIT, ETag e invalidación)', () => {
    let usuario;

    before(() => {
        crearUsuario('cache').then((u) => {
            usuario = u;
        });
    });

    beforeEach(() => {
        conAuth(usuario, { method: 'DELETE', url: '/api/cache' }); // cada prueba parte de un caché vacío
    });

    after(() => {
        eliminarUsuario(usuario);
    });

    it('la primera consulta es MISS y las siguientes HIT', () => {
        conAuth(usuario, { url: '/api/saldo' }).its('headers.x-cache').should('eq', 'MISS');
        conAuth(usuario, { url: '/api/saldo' }).its('headers.x-cache').should('eq', 'HIT');
        conAuth(usuario, { url: '/api/saldo' }).its('headers.x-cache').should('eq', 'HIT');
    });

    it('declara Cache-Control privado y entrega ETag', () => {
        conAuth(usuario, { url: '/api/ingresos' }).then((respuesta) => {
            expect(respuesta.headers['cache-control']).to.eq('private, no-cache');
            expect(respuesta.headers).to.have.property('etag');
        });
    });

    it('responde 304 si el cliente ya tiene la versión vigente', () => {
        conAuth(usuario, { url: '/api/ingresos' }).then((primera) => {
            conAuth(usuario, { url: '/api/ingresos', headers: { ...usuario.headers, 'If-None-Match': primera.headers.etag } })
                .its('status')
                .should('eq', 304);
        });
    });

    it('crear un ingreso invalida el caché y el saldo se actualiza', () => {
        conAuth(usuario, { url: '/api/saldo' }).then((antes) => {
            conAuth(usuario, { url: '/api/saldo' }).its('headers.x-cache').should('eq', 'HIT');

            conAuth(usuario, { method: 'POST', url: '/api/ingresos', body: { descripcion: 'Extra', valor: 5000, fecha: '2026-10-10' } })
                .its('status')
                .should('eq', 201);

            conAuth(usuario, { url: '/api/saldo' }).then((despues) => {
                expect(despues.headers['x-cache']).to.eq('MISS');
                expect(despues.body.saldo).to.eq(antes.body.saldo + 5000);
            });
        });
    });

    it('la invalidación manual vuelve a hacer MISS la siguiente consulta', () => {
        conAuth(usuario, { url: '/api/resumen' }).its('headers.x-cache').should('eq', 'MISS');
        conAuth(usuario, { url: '/api/resumen' }).its('headers.x-cache').should('eq', 'HIT');

        conAuth(usuario, { method: 'DELETE', url: '/api/cache' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body.entradasEliminadas).to.be.greaterThan(0);
        });

        conAuth(usuario, { url: '/api/resumen' }).its('headers.x-cache').should('eq', 'MISS');
    });

    it('las estadísticas reflejan los aciertos y los fallos', () => {
        conAuth(usuario, { url: '/api/saldo' });
        conAuth(usuario, { url: '/api/saldo' });

        conAuth(usuario, { url: '/api/cache/estadisticas' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body).to.have.all.keys('activo', 'entradas', 'hits', 'misses', 'invalidaciones', 'tasaAcierto');
            expect(respuesta.body.hits).to.be.greaterThan(0);
        });
    });

    it('los errores no se cachean', () => {
        conAuth(usuario, { url: '/api/ingresos?desde=ayer' }).its('status').should('eq', 400);
        conAuth(usuario, { url: '/api/ingresos?desde=ayer' }).its('headers').should('not.have.property', 'x-cache');
    });

    it('mide la mejora de tiempo entre MISS y HIT (como la demo de la clase)', () => {
        const medir = () => {
            const inicio = performance.now();

            return conAuth(usuario, { url: '/api/resumen/mensual?anio=2026' }).then((respuesta) => ({
                ms: performance.now() - inicio,
                estado: respuesta.headers['x-cache']
            }));
        };

        medir().then((miss) => {
            expect(miss.estado).to.eq('MISS');
            cy.log(`MISS: ${miss.ms.toFixed(1)} ms`);
        });

        medir().then((hit) => {
            expect(hit.estado).to.eq('HIT');
            cy.log(`HIT: ${hit.ms.toFixed(1)} ms`);
        });
    });
});
