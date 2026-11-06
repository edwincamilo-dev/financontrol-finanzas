const { crearUsuario, eliminarUsuario, conAuth } = require('../support/api');

describe('CRUD de ingresos y gastos', () => {
    let usuario;

    before(() => {
        crearUsuario('crud').then((u) => {
            usuario = u;
        });
    });

    after(() => {
        eliminarUsuario(usuario);
    });

    it('ciclo completo de un ingreso: crear, consultar, modificar y eliminar', () => {
        conAuth(usuario, { method: 'POST', url: '/api/ingresos', body: { descripcion: 'Salario', valor: 1500000, fecha: '2026-10-01' } })
            .then((creado) => {
                expect(creado.status).to.eq(201);
                expect(creado.body).to.have.property('id');

                const url = `/api/ingresos/${creado.body.id}`;

                conAuth(usuario, { url }).then((respuesta) => {
                    expect(respuesta.status).to.eq(200);
                    expect(respuesta.body).to.deep.eq({ id: creado.body.id, descripcion: 'Salario', valor: 1500000, fecha: '2026-10-01' });
                });

                conAuth(usuario, { method: 'PUT', url, body: { descripcion: 'Salario ajustado', valor: 1600000, fecha: '2026-10-02' } })
                    .its('status')
                    .should('eq', 200);

                conAuth(usuario, { url }).its('body.valor').should('eq', 1600000);

                conAuth(usuario, { method: 'DELETE', url }).its('status').should('eq', 200);
                conAuth(usuario, { url }).its('status').should('eq', 404);
            });
    });

    it('ciclo completo de un gasto: crear, consultar, modificar y eliminar', () => {
        conAuth(usuario, {
            method: 'POST',
            url: '/api/gastos',
            body: { descripcion: 'Mercado', valor: 200000, categoria: 'Alimentación', fecha: '2026-10-03' }
        }).then((creado) => {
            expect(creado.status).to.eq(201);

            const url = `/api/gastos/${creado.body.id}`;

            conAuth(usuario, { url }).then((respuesta) => {
                expect(respuesta.status).to.eq(200);
                expect(respuesta.body).to.include({ descripcion: 'Mercado', categoria: 'Alimentación', valor: 200000 });
            });

            conAuth(usuario, {
                method: 'PUT',
                url,
                body: { descripcion: 'Mercado grande', valor: 250000, categoria: 'Alimentación', fecha: '2026-10-04' }
            }).its('status').should('eq', 200);

            conAuth(usuario, { url }).its('body.descripcion').should('eq', 'Mercado grande');

            conAuth(usuario, { method: 'DELETE', url }).its('status').should('eq', 200);
            conAuth(usuario, { url }).its('status').should('eq', 404);
        });
    });

    it('casos negativos: datos obligatorios, valor, fecha y token', () => {
        conAuth(usuario, { method: 'POST', url: '/api/ingresos', body: {} }).then((respuesta) => {
            expect(respuesta.status).to.eq(400);
            expect(respuesta.body.mensaje).to.eq('Descripción, valor y fecha son obligatorios');
        });

        conAuth(usuario, { method: 'POST', url: '/api/ingresos', body: { descripcion: 'X', valor: 0, fecha: '2026-10-01' } })
            .its('body.mensaje')
            .should('eq', 'El valor debe ser mayor que 0');

        conAuth(usuario, { method: 'POST', url: '/api/gastos', body: { descripcion: 'X', valor: -5, categoria: 'Otros', fecha: '2026-10-01' } })
            .its('status')
            .should('eq', 400);

        conAuth(usuario, { method: 'POST', url: '/api/gastos', body: { descripcion: 'X', valor: 5, categoria: 'Otros', fecha: '31/10/2026' } })
            .its('status')
            .should('eq', 400);

        cy.request({ method: 'POST', url: '/api/ingresos', body: { descripcion: 'X', valor: 1, fecha: '2026-10-01' }, failOnStatusCode: false })
            .its('status')
            .should('eq', 401);
    });

    it('un id inexistente responde 404', () => {
        conAuth(usuario, { url: '/api/ingresos/99999999' }).its('status').should('eq', 404);
        conAuth(usuario, { url: '/api/gastos/99999999' }).its('status').should('eq', 404);
        conAuth(usuario, { method: 'DELETE', url: '/api/gastos/99999999' }).its('status').should('eq', 404);
    });
});
