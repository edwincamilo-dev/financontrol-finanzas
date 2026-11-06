const {
    LIMITE_MAXIMO,
    esFechaValida,
    formatearFecha,
    normalizarMovimiento,
    leerRangoFechas,
    leerPaginacion,
    condicionesBase,
    redondear
} = require('../src/utils/filtros');

describe('utilidades de filtros', () => {

    describe('esFechaValida', () => {
        test('acepta fechas reales en formato AAAA-MM-DD', () => {
            expect(esFechaValida('2026-10-16')).toBe(true);
            expect(esFechaValida('2028-02-29')).toBe(true);
        });

        test('rechaza fechas inexistentes', () => {
            expect(esFechaValida('2026-02-30')).toBe(false);
            expect(esFechaValida('2026-13-01')).toBe(false);
            expect(esFechaValida('2027-02-29')).toBe(false);
        });

        test('rechaza formatos incorrectos y valores que no son texto', () => {
            expect(esFechaValida('16/10/2026')).toBe(false);
            expect(esFechaValida('2026-1-5')).toBe(false);
            expect(esFechaValida('')).toBe(false);
            expect(esFechaValida(undefined)).toBe(false);
            expect(esFechaValida(20261016)).toBe(false);
        });
    });

    describe('formatearFecha', () => {
        test('convierte un objeto Date a AAAA-MM-DD usando la fecha local', () => {
            expect(formatearFecha(new Date(2026, 8, 28))).toBe('2026-09-28');
            expect(formatearFecha(new Date(2026, 0, 5))).toBe('2026-01-05');
        });

        test('recorta textos con hora', () => {
            expect(formatearFecha('2026-09-28T05:00:00.000Z')).toBe('2026-09-28');
            expect(formatearFecha('2026-09-28')).toBe('2026-09-28');
        });
    });

    describe('normalizarMovimiento', () => {
        test('devuelve el valor como número y la fecha como texto', () => {
            const resultado = normalizarMovimiento({
                id: 1,
                descripcion: 'Salario',
                valor: '1500000.00',
                fecha: new Date(2026, 9, 1)
            });

            expect(resultado).toEqual({
                id: 1,
                descripcion: 'Salario',
                valor: 1500000,
                fecha: '2026-10-01'
            });
        });

        test('no falla con valores vacíos', () => {
            expect(normalizarMovimiento(undefined)).toBeUndefined();
        });
    });

    describe('leerRangoFechas', () => {
        test('sin filtros devuelve nulos', () => {
            expect(leerRangoFechas({})).toEqual({ desde: null, hasta: null });
        });

        test('acepta un rango válido', () => {
            expect(leerRangoFechas({ desde: '2026-01-01', hasta: '2026-01-31' }))
                .toEqual({ desde: '2026-01-01', hasta: '2026-01-31' });
        });

        test('acepta un solo extremo', () => {
            expect(leerRangoFechas({ desde: '2026-01-01' }).error).toBeUndefined();
            expect(leerRangoFechas({ hasta: '2026-01-31' }).error).toBeUndefined();
        });

        test('rechaza fechas inválidas', () => {
            expect(leerRangoFechas({ desde: 'ayer' }).error).toMatch(/AAAA-MM-DD/);
            expect(leerRangoFechas({ hasta: '2026-02-30' }).error).toMatch(/AAAA-MM-DD/);
        });

        test('rechaza un rango invertido', () => {
            expect(leerRangoFechas({ desde: '2026-02-01', hasta: '2026-01-01' }).error)
                .toMatch(/no puede ser mayor/);
        });
    });

    describe('leerPaginacion', () => {
        test('sin parámetros no pagina', () => {
            expect(leerPaginacion({})).toEqual({ paginar: false });
        });

        test('calcula el desplazamiento', () => {
            expect(leerPaginacion({ pagina: '3', limite: '5' }))
                .toEqual({ paginar: true, pagina: 3, limite: 5, offset: 10 });
        });

        test('usa valores por defecto si falta uno de los dos', () => {
            expect(leerPaginacion({ limite: '20' })).toMatchObject({ pagina: 1, limite: 20, offset: 0 });
            expect(leerPaginacion({ pagina: '2' })).toMatchObject({ pagina: 2, limite: 10, offset: 10 });
        });

        test('rechaza límites y páginas inválidos', () => {
            expect(leerPaginacion({ limite: '0' }).error).toBeDefined();
            expect(leerPaginacion({ limite: String(LIMITE_MAXIMO + 1) }).error).toBeDefined();
            expect(leerPaginacion({ limite: 'abc' }).error).toBeDefined();
            expect(leerPaginacion({ limite: '1.5' }).error).toBeDefined();
            expect(leerPaginacion({ pagina: '0' }).error).toBeDefined();
            expect(leerPaginacion({ pagina: '-2' }).error).toBeDefined();
        });
    });

    describe('condicionesBase', () => {
        test('sin filtros no agrega condiciones', () => {
            expect(condicionesBase({})).toEqual({ condiciones: [], params: [] });
        });

        test('arma las condiciones y los parámetros en orden', () => {
            const { condiciones, params } = condicionesBase({
                desde: '2026-01-01',
                hasta: '2026-01-31',
                buscar: 'pan'
            });

            expect(condiciones).toEqual(['DATE(fecha) >= ?', 'DATE(fecha) <= ?', 'descripcion LIKE ?']);
            expect(params).toEqual(['2026-01-01', '2026-01-31', '%pan%']);
        });

        test('el texto de búsqueda va como parámetro, nunca dentro del SQL', () => {
            const { condiciones, params } = condicionesBase({ buscar: "'; DROP TABLE gastos; --" });

            expect(condiciones.join(' ')).not.toMatch(/DROP/);
            expect(params[0]).toContain('DROP TABLE');
        });
    });

    describe('redondear', () => {
        test('redondea a dos decimales por defecto', () => {
            expect(redondear(10.005)).toBe(10.01);
            expect(redondear(1 / 3)).toBe(0.33);
        });

        test('acepta otra cantidad de decimales', () => {
            expect(redondear(33.3333, 1)).toBe(33.3);
        });
    });
});
