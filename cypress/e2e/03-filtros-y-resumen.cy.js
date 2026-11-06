const { crearUsuario, eliminarUsuario, conAuth } = require('../support/api');

describe('Consultas por fechas, categorías, movimientos y resumen financiero', () => {
    let usuario;

    before(() => {
        crearUsuario('resumen').then((u) => {
            usuario = u;

            const ingresos = [
                { descripcion: 'Salario enero', valor: 1000000, fecha: '2026-01-10' },
                { descripcion: 'Trabajo freelance', valor: 500000, fecha: '2026-01-20' },
                { descripcion: 'Bono febrero', valor: 200000, fecha: '2026-02-05' }
            ];
            const gastos = [
                { descripcion: 'Mercado', valor: 150000, categoria: 'Alimentación', fecha: '2026-01-12' },
                { descripcion: 'Bus', valor: 50000, categoria: 'Transporte', fecha: '2026-01-15' },
                { descripcion: 'Almuerzo', valor: 30000, categoria: 'Alimentación', fecha: '2026-01-25' },
                { descripcion: 'Cine', valor: 40000, categoria: 'Ocio', fecha: '2026-02-07' }
            ];

            ingresos.forEach((body) => conAuth(u, { method: 'POST', url: '/api/ingresos', body }));
            gastos.forEach((body) => conAuth(u, { method: 'POST', url: '/api/gastos', body }));
        });
    });

    after(() => {
        eliminarUsuario(usuario);
    });

    it('filtra los ingresos por rango de fechas', () => {
        conAuth(usuario, { url: '/api/ingresos?desde=2026-01-01&hasta=2026-01-31' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body).to.have.length(2);
        });
    });

    it('busca ingresos por descripción', () => {
        conAuth(usuario, { url: '/api/ingresos?buscar=bono' }).its('body').should('have.length', 1);
    });

    it('filtra los gastos por categoría y fechas', () => {
        conAuth(usuario, { url: `/api/gastos?categoria=${encodeURIComponent('Alimentación')}&desde=2026-01-20` })
            .its('body.0.descripcion')
            .should('eq', 'Almuerzo');
    });

    it('rechaza fechas inválidas y rangos invertidos', () => {
        conAuth(usuario, { url: '/api/ingresos?desde=ayer' }).its('status').should('eq', 400);
        conAuth(usuario, { url: '/api/gastos?desde=2026-03-01&hasta=2026-01-01' }).its('status').should('eq', 400);
    });

    it('pagina los resultados e informa el total en cabeceras', () => {
        conAuth(usuario, { url: '/api/ingresos?pagina=1&limite=2' }).then((respuesta) => {
            expect(respuesta.body).to.have.length(2);
            expect(respuesta.headers['x-total-count']).to.eq('3');
            expect(respuesta.headers['x-page']).to.eq('1');
        });
    });

    it('lista las categorías con cantidad, total y porcentaje', () => {
        conAuth(usuario, { url: '/api/gastos/categorias' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.body[0]).to.deep.eq({ categoria: 'Alimentación', cantidad: 2, total: 180000, porcentaje: 66.7 });
            expect(respuesta.body).to.have.length(3);
        });
    });

    it('lista ingresos y gastos juntos, del más reciente al más antiguo', () => {
        conAuth(usuario, { url: '/api/movimientos' }).then((respuesta) => {
            expect(respuesta.body).to.have.length(7);
            expect(respuesta.body[0]).to.include({ tipo: 'gasto', descripcion: 'Cine' });
        });

        conAuth(usuario, { url: '/api/movimientos?tipo=ingreso' }).its('body').should('have.length', 3);
        conAuth(usuario, { url: '/api/movimientos?tipo=otro' }).its('status').should('eq', 400);
    });

    it('exporta los movimientos a CSV', () => {
        conAuth(usuario, { url: '/api/movimientos/exportar' }).then((respuesta) => {
            expect(respuesta.status).to.eq(200);
            expect(respuesta.headers['content-type']).to.include('text/csv');
            expect(respuesta.body).to.include('tipo,id,fecha,descripcion,categoria,valor');
            expect(respuesta.body).to.include('Cine');
        });
    });

    it('calcula el saldo: ingresos menos gastos', () => {
        conAuth(usuario, { url: '/api/saldo' }).then((respuesta) => {
            expect(respuesta.body).to.deep.eq({ totalIngresos: 1700000, totalGastos: 270000, saldo: 1430000 });
        });
    });

    it('resume un periodo con gastos por categoría', () => {
        conAuth(usuario, { url: '/api/resumen?desde=2026-01-01&hasta=2026-01-31' }).then((respuesta) => {
            expect(respuesta.body).to.include({ totalIngresos: 1500000, totalGastos: 230000, saldo: 1270000 });
            expect(respuesta.body.gastosPorCategoria[0].categoria).to.eq('Alimentación');
        });
    });

    it('resume mes a mes un año completo', () => {
        conAuth(usuario, { url: '/api/resumen/mensual?anio=2026' }).then((respuesta) => {
            expect(respuesta.body.meses).to.have.length(12);
            expect(respuesta.body.meses[0]).to.include({ nombre: 'enero', ingresos: 1500000, gastos: 230000 });
            expect(respuesta.body.meses[1]).to.include({ nombre: 'febrero', saldo: 160000 });
        });
    });
});
