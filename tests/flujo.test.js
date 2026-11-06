// Pruebas de integración del flujo completo de FinanControl.
// Usan la base de datos real definida en .env y crean sus propios usuarios de prueba,
// que se eliminan al terminar. No dependen de datos previos.

const request = require('supertest');

const app = require('../src/server');
const pool = require('../src/config/database');
const cache = require('../src/middleware/cache');

const sufijo = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
const correoPrincipal = `qa.principal.${sufijo}@financontrol.test`;
const correoSecundario = `qa.secundario.${sufijo}@financontrol.test`;
const passwordInicial = 'Clave-Inicial-1';
const passwordNueva = 'Clave-Nueva-2';

const autorizar = (token) => ({ Authorization: `Bearer ${token}` });

async function registrarYEntrar(nombre, correo, password) {
    await request(app)
        .post('/api/usuarios/registro')
        .send({ nombre, correo, password });

    const login = await request(app)
        .post('/api/usuarios/login')
        .send({ correo, password });

    return login.body.token;
}

describe('FinanControl: flujo completo de la API', () => {

    let token;
    let tokenSecundario;
    let idPrincipal;

    beforeAll(async () => {
        cache.reiniciar();

        token = await registrarYEntrar('Usuario QA', correoPrincipal, passwordInicial);

        const perfil = await request(app).get('/api/usuarios/perfil').set(autorizar(token));
        idPrincipal = perfil.body.id;

        // Datos con fechas fijas para que los filtros sean predecibles
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

        for (const ingreso of ingresos) {
            await request(app).post('/api/ingresos').set(autorizar(token)).send(ingreso);
        }

        for (const gasto of gastos) {
            await request(app).post('/api/gastos').set(autorizar(token)).send(gasto);
        }
    });

    afterAll(async () => {
        // Limpieza por si alguna prueba falló antes de eliminar la cuenta
        await pool.query('DELETE FROM ingresos WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo LIKE ?)', [`qa.%.${sufijo}@financontrol.test`]);
        await pool.query('DELETE FROM gastos WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo LIKE ?)', [`qa.%.${sufijo}@financontrol.test`]);
        await pool.query('DELETE FROM usuarios WHERE correo LIKE ?', [`qa.%.${sufijo}@financontrol.test`]);

        await pool.end();
    });

    describe('usuarios: registro y login', () => {
        test('rechaza un registro con campos faltantes', async () => {
            const respuesta = await request(app)
                .post('/api/usuarios/registro')
                .send({ correo: 'sin-nombre@financontrol.test' });

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.body.mensaje).toBe('Todos los campos son obligatorios');
        });

        test('rechaza un correo ya registrado', async () => {
            const respuesta = await request(app)
                .post('/api/usuarios/registro')
                .send({ nombre: 'Repetido', correo: correoPrincipal, password: passwordInicial });

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.body.mensaje).toBe('El correo ya está registrado');
        });

        test('rechaza el login con contraseña incorrecta', async () => {
            const respuesta = await request(app)
                .post('/api/usuarios/login')
                .send({ correo: correoPrincipal, password: 'incorrecta' });

            expect(respuesta.statusCode).toBe(401);
        });

        test('rechaza el login sin datos', async () => {
            const respuesta = await request(app).post('/api/usuarios/login').send({});

            expect(respuesta.statusCode).toBe(400);
        });

        test('el login correcto entrega un token', async () => {
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3);
        });
    });

    describe('ingresos y gastos: CRUD completo', () => {
        test('crea, consulta, modifica y elimina un ingreso', async () => {
            const creado = await request(app)
                .post('/api/ingresos')
                .set(autorizar(token))
                .send({ descripcion: 'Venta', valor: 75000, fecha: '2026-03-01' });

            expect(creado.statusCode).toBe(201);
            const id = creado.body.id;

            const consulta = await request(app).get(`/api/ingresos/${id}`).set(autorizar(token));
            expect(consulta.statusCode).toBe(200);
            expect(consulta.body).toEqual({ id, descripcion: 'Venta', valor: 75000, fecha: '2026-03-01' });

            const modificado = await request(app)
                .put(`/api/ingresos/${id}`)
                .set(autorizar(token))
                .send({ descripcion: 'Venta corregida', valor: 80000, fecha: '2026-03-02' });
            expect(modificado.statusCode).toBe(200);

            const despues = await request(app).get(`/api/ingresos/${id}`).set(autorizar(token));
            expect(despues.body).toMatchObject({ descripcion: 'Venta corregida', valor: 80000, fecha: '2026-03-02' });

            const eliminado = await request(app).delete(`/api/ingresos/${id}`).set(autorizar(token));
            expect(eliminado.statusCode).toBe(200);

            const inexistente = await request(app).get(`/api/ingresos/${id}`).set(autorizar(token));
            expect(inexistente.statusCode).toBe(404);
        });

        test('crea, consulta, modifica y elimina un gasto', async () => {
            const creado = await request(app)
                .post('/api/gastos')
                .set(autorizar(token))
                .send({ descripcion: 'Taxi', valor: 20000, categoria: 'Transporte', fecha: '2026-03-01' });

            expect(creado.statusCode).toBe(201);
            const id = creado.body.id;

            const consulta = await request(app).get(`/api/gastos/${id}`).set(autorizar(token));
            expect(consulta.body).toEqual({
                id, descripcion: 'Taxi', valor: 20000, categoria: 'Transporte', fecha: '2026-03-01'
            });

            const modificado = await request(app)
                .put(`/api/gastos/${id}`)
                .set(autorizar(token))
                .send({ descripcion: 'Taxi aeropuerto', valor: 35000, categoria: 'Transporte', fecha: '2026-03-02' });
            expect(modificado.statusCode).toBe(200);

            const eliminado = await request(app).delete(`/api/gastos/${id}`).set(autorizar(token));
            expect(eliminado.statusCode).toBe(200);

            const inexistente = await request(app).get(`/api/gastos/${id}`).set(autorizar(token));
            expect(inexistente.statusCode).toBe(404);
        });

        test('rechaza fechas con formato inválido al crear', async () => {
            const ingreso = await request(app)
                .post('/api/ingresos')
                .set(autorizar(token))
                .send({ descripcion: 'X', valor: 100, fecha: '10/01/2026' });

            const gasto = await request(app)
                .post('/api/gastos')
                .set(autorizar(token))
                .send({ descripcion: 'X', valor: 100, categoria: 'Otros', fecha: '2026-02-30' });

            expect(ingreso.statusCode).toBe(400);
            expect(ingreso.body.mensaje).toMatch(/fecha/i);
            expect(gasto.statusCode).toBe(400);
        });

        test('rechaza un valor que no es numérico', async () => {
            const respuesta = await request(app)
                .post('/api/ingresos')
                .set(autorizar(token))
                .send({ descripcion: 'X', valor: 'mucho', fecha: '2026-01-01' });

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.body.mensaje).toBe('El valor debe ser mayor que 0');
        });

        test('un usuario no puede ver ni borrar los datos de otro', async () => {
            tokenSecundario = await registrarYEntrar('Otro Usuario', correoSecundario, passwordInicial);

            const lista = await request(app).get('/api/ingresos').set(autorizar(tokenSecundario));
            expect(lista.body).toEqual([]);

            const propio = await request(app).get('/api/ingresos').set(autorizar(token));
            const idAjeno = propio.body[0].id;

            const consulta = await request(app).get(`/api/ingresos/${idAjeno}`).set(autorizar(tokenSecundario));
            const borrado = await request(app).delete(`/api/ingresos/${idAjeno}`).set(autorizar(tokenSecundario));

            expect(consulta.statusCode).toBe(404);
            expect(borrado.statusCode).toBe(404);
        });
    });

    describe('consulta por fechas, búsqueda y paginación', () => {
        test('los ingresos se filtran por "desde"', async () => {
            const respuesta = await request(app)
                .get('/api/ingresos?desde=2026-01-15')
                .set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body.map((i) => i.descripcion)).toEqual(['Bono febrero', 'Trabajo freelance']);
        });

        test('los ingresos se filtran por rango "desde" y "hasta"', async () => {
            const respuesta = await request(app)
                .get('/api/ingresos?desde=2026-01-01&hasta=2026-01-31')
                .set(autorizar(token));

            expect(respuesta.body).toHaveLength(2);
            expect(respuesta.body.every((i) => i.fecha.startsWith('2026-01'))).toBe(true);
        });

        test('los ingresos se pueden buscar por descripción', async () => {
            const respuesta = await request(app)
                .get('/api/ingresos?buscar=salario')
                .set(autorizar(token));

            expect(respuesta.body).toHaveLength(1);
            expect(respuesta.body[0].descripcion).toBe('Salario enero');
        });

        test('los gastos se filtran por fechas y por categoría', async () => {
            const respuesta = await request(app)
                .get('/api/gastos?categoria=Alimentación&desde=2026-01-20&hasta=2026-01-31')
                .set(autorizar(token));

            expect(respuesta.body).toHaveLength(1);
            expect(respuesta.body[0]).toMatchObject({ descripcion: 'Almuerzo', valor: 30000 });
        });

        test('la ruta por categoría también acepta rango de fechas', async () => {
            const respuesta = await request(app)
                .get(`/api/gastos/categoria/${encodeURIComponent('Alimentación')}?hasta=2026-01-15`)
                .set(autorizar(token));

            expect(respuesta.body).toHaveLength(1);
            expect(respuesta.body[0].descripcion).toBe('Mercado');
        });

        test('rechaza fechas inválidas o rangos invertidos', async () => {
            const invalida = await request(app).get('/api/ingresos?desde=ayer').set(autorizar(token));
            const invertido = await request(app)
                .get('/api/gastos?desde=2026-03-01&hasta=2026-01-01')
                .set(autorizar(token));

            expect(invalida.statusCode).toBe(400);
            expect(invertido.statusCode).toBe(400);
            expect(invertido.body.mensaje).toMatch(/no puede ser mayor/);
        });

        test('pagina los resultados e informa el total en las cabeceras', async () => {
            const primera = await request(app)
                .get('/api/ingresos?pagina=1&limite=2')
                .set(autorizar(token));
            const segunda = await request(app)
                .get('/api/ingresos?pagina=2&limite=2')
                .set(autorizar(token));

            expect(primera.body).toHaveLength(2);
            expect(segunda.body).toHaveLength(1);
            expect(primera.headers['x-total-count']).toBe('3');
            expect(primera.headers['x-page']).toBe('1');
            expect(primera.headers['x-limit']).toBe('2');
            expect(segunda.headers['x-page']).toBe('2');
        });

        test('rechaza una paginación inválida', async () => {
            const respuesta = await request(app)
                .get('/api/gastos?limite=1000')
                .set(autorizar(token));

            expect(respuesta.statusCode).toBe(400);
        });
    });

    describe('movimientos, categorías y exportación', () => {
        test('lista ingresos y gastos juntos, del más reciente al más antiguo', async () => {
            const respuesta = await request(app).get('/api/movimientos').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body).toHaveLength(7);
            expect(respuesta.body[0]).toMatchObject({ tipo: 'gasto', descripcion: 'Cine', fecha: '2026-02-07' });

            const fechas = respuesta.body.map((m) => m.fecha);
            expect([...fechas].sort().reverse()).toEqual(fechas);
        });

        test('filtra movimientos por tipo y por rango de fechas', async () => {
            const gastos = await request(app).get('/api/movimientos?tipo=gasto').set(autorizar(token));
            const enero = await request(app)
                .get('/api/movimientos?desde=2026-01-01&hasta=2026-01-31')
                .set(autorizar(token));

            expect(gastos.body).toHaveLength(4);
            expect(gastos.body.every((m) => m.tipo === 'gasto')).toBe(true);
            expect(enero.body).toHaveLength(5);
        });

        test('filtra movimientos por categoría (solo gastos) y por texto', async () => {
            const ocio = await request(app).get('/api/movimientos?categoria=Ocio').set(autorizar(token));
            const bono = await request(app).get('/api/movimientos?buscar=bono').set(autorizar(token));

            expect(ocio.body).toHaveLength(1);
            expect(ocio.body[0].descripcion).toBe('Cine');
            expect(bono.body).toHaveLength(1);
            expect(bono.body[0].tipo).toBe('ingreso');
        });

        test('pagina los movimientos', async () => {
            const respuesta = await request(app)
                .get('/api/movimientos?pagina=2&limite=3')
                .set(autorizar(token));

            expect(respuesta.body).toHaveLength(3);
            expect(respuesta.headers['x-total-count']).toBe('7');
        });

        test('rechaza un tipo desconocido', async () => {
            const respuesta = await request(app).get('/api/movimientos?tipo=otro').set(autorizar(token));

            expect(respuesta.statusCode).toBe(400);
        });

        test('lista las categorías con cantidad, total y porcentaje', async () => {
            const respuesta = await request(app).get('/api/gastos/categorias').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body).toEqual([
                { categoria: 'Alimentación', cantidad: 2, total: 180000, porcentaje: 66.7 },
                { categoria: 'Transporte', cantidad: 1, total: 50000, porcentaje: 18.5 },
                { categoria: 'Ocio', cantidad: 1, total: 40000, porcentaje: 14.8 }
            ]);
        });

        test('las categorías también aceptan rango de fechas', async () => {
            const respuesta = await request(app)
                .get('/api/gastos/categorias?desde=2026-02-01')
                .set(autorizar(token));

            expect(respuesta.body).toEqual([
                { categoria: 'Ocio', cantidad: 1, total: 40000, porcentaje: 100 }
            ]);
        });

        test('exporta los movimientos como CSV', async () => {
            const respuesta = await request(app).get('/api/movimientos/exportar').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.headers['content-type']).toMatch(/text\/csv/);
            expect(respuesta.headers['content-disposition']).toMatch(/movimientos\.csv/);

            const lineas = respuesta.text.replace('﻿', '').trim().split('\r\n');

            expect(lineas[0]).toBe('tipo,id,fecha,descripcion,categoria,valor');
            expect(lineas).toHaveLength(8);
            expect(lineas[1]).toMatch(/^gasto,\d+,2026-02-07,Cine,Ocio,40000$/);
        });

        test('el CSV neutraliza fórmulas y escapa comas y comillas', async () => {
            const creado = await request(app)
                .post('/api/gastos')
                .set(autorizar(token))
                .send({ descripcion: '=SUMA(1,2) "x"', valor: 1, categoria: 'Prueba', fecha: '2026-04-01' });

            const respuesta = await request(app)
                .get('/api/movimientos/exportar?categoria=Prueba')
                .set(autorizar(token));

            expect(respuesta.text).toContain(`"'=SUMA(1,2) ""x"""`);

            await request(app).delete(`/api/gastos/${creado.body.id}`).set(autorizar(token));
        });
    });

    describe('resumen financiero', () => {
        test('el saldo coincide con ingresos menos gastos', async () => {
            const respuesta = await request(app).get('/api/saldo').set(autorizar(token));

            expect(respuesta.body).toEqual({ totalIngresos: 1700000, totalGastos: 270000, saldo: 1430000 });
        });

        test('resume un periodo con gastos por categoría', async () => {
            const respuesta = await request(app)
                .get('/api/resumen?desde=2026-01-01&hasta=2026-01-31')
                .set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body).toMatchObject({
                periodo: { desde: '2026-01-01', hasta: '2026-01-31' },
                totalIngresos: 1500000,
                totalGastos: 230000,
                saldo: 1270000,
                cantidadIngresos: 2,
                cantidadGastos: 3
            });
            expect(respuesta.body.gastosPorCategoria[0]).toEqual({
                categoria: 'Alimentación', cantidad: 2, total: 180000, porcentaje: 78.3
            });
        });

        test('sin filtros resume todo el historial', async () => {
            const respuesta = await request(app).get('/api/resumen').set(autorizar(token));

            expect(respuesta.body).toMatchObject({ totalIngresos: 1700000, totalGastos: 270000, saldo: 1430000 });
            expect(respuesta.body.periodo).toEqual({ desde: null, hasta: null });
        });

        test('un periodo sin movimientos devuelve ceros', async () => {
            const respuesta = await request(app)
                .get('/api/resumen?desde=2020-01-01&hasta=2020-12-31')
                .set(autorizar(token));

            expect(respuesta.body).toMatchObject({ totalIngresos: 0, totalGastos: 0, saldo: 0, gastosPorCategoria: [] });
        });

        test('entrega el resumen mes a mes de un año', async () => {
            const respuesta = await request(app).get('/api/resumen/mensual?anio=2026').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body.anio).toBe(2026);
            expect(respuesta.body.meses).toHaveLength(12);
            expect(respuesta.body.meses[0]).toEqual({ mes: 1, nombre: 'enero', ingresos: 1500000, gastos: 230000, saldo: 1270000 });
            expect(respuesta.body.meses[1]).toEqual({ mes: 2, nombre: 'febrero', ingresos: 200000, gastos: 40000, saldo: 160000 });
            expect(respuesta.body.meses[2]).toMatchObject({ mes: 3, ingresos: 0, gastos: 0, saldo: 0 });
            expect(respuesta.body).toMatchObject({ totalIngresos: 1700000, totalGastos: 270000, saldo: 1430000 });
        });

        test('rechaza un año inválido', async () => {
            const respuesta = await request(app).get('/api/resumen/mensual?anio=abc').set(autorizar(token));

            expect(respuesta.statusCode).toBe(400);
        });

        test('las rutas de resumen exigen token', async () => {
            const resumen = await request(app).get('/api/resumen');
            const movimientos = await request(app).get('/api/movimientos');
            const categorias = await request(app).get('/api/gastos/categorias');

            expect(resumen.statusCode).toBe(401);
            expect(movimientos.statusCode).toBe(401);
            expect(categorias.statusCode).toBe(401);
        });
    });

    describe('caché', () => {
        beforeEach(() => {
            cache.reiniciar();
        });

        test('la primera consulta es MISS y la segunda HIT', async () => {
            const primera = await request(app).get('/api/saldo').set(autorizar(token));
            const segunda = await request(app).get('/api/saldo').set(autorizar(token));

            expect(primera.headers['x-cache']).toBe('MISS');
            expect(segunda.headers['x-cache']).toBe('HIT');
            expect(segunda.body).toEqual(primera.body);
            expect(segunda.headers['cache-control']).toBe('private, no-cache');
        });

        test('responde 304 cuando el cliente ya tiene la versión vigente (ETag)', async () => {
            const primera = await request(app).get('/api/ingresos').set(autorizar(token));
            const etag = primera.headers.etag;

            expect(etag).toBeDefined();

            const validacion = await request(app)
                .get('/api/ingresos')
                .set(autorizar(token))
                .set('If-None-Match', etag);

            expect(validacion.statusCode).toBe(304);
            expect(validacion.text).toBeFalsy();
        });

        test('cada URL (con sus filtros) tiene su propia entrada', async () => {
            await request(app).get('/api/ingresos?desde=2026-01-01').set(autorizar(token));
            const otra = await request(app).get('/api/ingresos?desde=2026-02-01').set(autorizar(token));

            expect(otra.headers['x-cache']).toBe('MISS');
        });

        test('conserva las cabeceras de paginación en un HIT', async () => {
            await request(app).get('/api/ingresos?pagina=1&limite=2').set(autorizar(token));
            const hit = await request(app).get('/api/ingresos?pagina=1&limite=2').set(autorizar(token));

            expect(hit.headers['x-cache']).toBe('HIT');
            expect(hit.headers['x-total-count']).toBe('3');
        });

        test('crear un ingreso invalida el caché y el saldo se actualiza', async () => {
            const antes = await request(app).get('/api/saldo').set(autorizar(token));
            await request(app).get('/api/saldo').set(autorizar(token)); // HIT

            const creado = await request(app)
                .post('/api/ingresos')
                .set(autorizar(token))
                .send({ descripcion: 'Extra', valor: 1000, fecha: '2026-05-01' });

            const despues = await request(app).get('/api/saldo').set(autorizar(token));

            expect(despues.headers['x-cache']).toBe('MISS');
            expect(despues.body.saldo).toBe(antes.body.saldo + 1000);

            await request(app).delete(`/api/ingresos/${creado.body.id}`).set(autorizar(token));

            const final = await request(app).get('/api/saldo').set(autorizar(token));
            expect(final.body.saldo).toBe(antes.body.saldo);
        });

        test('una escritura rechazada (400) NO invalida el caché', async () => {
            await request(app).get('/api/saldo').set(autorizar(token));

            await request(app).post('/api/ingresos').set(autorizar(token)).send({});

            const respuesta = await request(app).get('/api/saldo').set(autorizar(token));

            expect(respuesta.headers['x-cache']).toBe('HIT');
        });

        test('los errores no se guardan en el caché', async () => {
            const primera = await request(app).get('/api/ingresos?desde=ayer').set(autorizar(token));
            const segunda = await request(app).get('/api/ingresos?desde=ayer').set(autorizar(token));

            expect(primera.statusCode).toBe(400);
            expect(segunda.statusCode).toBe(400);
            expect(segunda.headers['x-cache']).toBeUndefined();
        });

        test('sin token o con token inválido no se usa el caché', async () => {
            const sinToken = await request(app).get('/api/saldo');
            const falso = await request(app).get('/api/saldo').set(autorizar('token-falso'));

            expect(sinToken.statusCode).toBe(401);
            expect(falso.statusCode).toBe(401);
            expect(sinToken.headers['x-cache']).toBeUndefined();
        });

        test('el caché de un usuario no se comparte con otro', async () => {
            await request(app).get('/api/saldo').set(autorizar(token)); // llena el caché del principal

            const otro = await request(app).get('/api/saldo').set(autorizar(tokenSecundario));

            expect(otro.headers['x-cache']).toBe('MISS');
            expect(otro.body).toEqual({ totalIngresos: 0, totalGastos: 0, saldo: 0 });
        });

        test('las estadísticas cuentan hits, misses y entradas', async () => {
            await request(app).get('/api/saldo').set(autorizar(token));
            await request(app).get('/api/saldo').set(autorizar(token));
            await request(app).get('/api/saldo').set(autorizar(token));

            const respuesta = await request(app).get('/api/cache/estadisticas').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body).toMatchObject({ activo: true, entradas: 1, hits: 2, misses: 1 });
            expect(respuesta.body.tasaAcierto).toBeCloseTo(66.7, 1);
        });

        test('la invalidación manual vacía el caché del usuario', async () => {
            await request(app).get('/api/saldo').set(autorizar(token));
            await request(app).get('/api/ingresos').set(autorizar(token));

            const invalidacion = await request(app).delete('/api/cache').set(autorizar(token));
            const siguiente = await request(app).get('/api/saldo').set(autorizar(token));

            expect(invalidacion.statusCode).toBe(200);
            expect(invalidacion.body.entradasEliminadas).toBe(2);
            expect(siguiente.headers['x-cache']).toBe('MISS');
        });

        test('las rutas de gestión del caché exigen token', async () => {
            const estadisticas = await request(app).get('/api/cache/estadisticas');
            const invalidar = await request(app).delete('/api/cache');

            expect(estadisticas.statusCode).toBe(401);
            expect(invalidar.statusCode).toBe(401);
        });

        test('el TTL depende de la ruta y se puede ajustar por variable de entorno', () => {
            expect(cache.ttlPara('/api/saldo')).toBe(30);
            expect(cache.ttlPara('/api/resumen?desde=2026-01-01')).toBe(120);
            expect(cache.ttlPara('/api/ingresos')).toBe(60);

            process.env.CACHE_TTL_SEGUNDOS = '5';
            expect(cache.ttlPara('/api/saldo')).toBe(5);
            delete process.env.CACHE_TTL_SEGUNDOS;
        });

        test('una entrada vencida vuelve a consultarse (TTL)', async () => {
            const ahora = Date.now();
            const reloj = jest.spyOn(Date, 'now');

            reloj.mockReturnValue(ahora);
            await request(app).get('/api/saldo').set(autorizar(token));

            reloj.mockReturnValue(ahora + 31 * 1000); // el TTL de /api/saldo es 30 s
            const vencida = await request(app).get('/api/saldo').set(autorizar(token));

            reloj.mockRestore();

            expect(vencida.headers['x-cache']).toBe('MISS');
        });
    });

    describe('usuarios: perfil y seguridad de la cuenta', () => {
        test('consulta el perfil sin exponer la contraseña', async () => {
            const respuesta = await request(app).get('/api/usuarios/perfil').set(autorizar(token));

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body).toEqual({ id: idPrincipal, nombre: 'Usuario QA', correo: correoPrincipal });
            expect(respuesta.body).not.toHaveProperty('password');
        });

        test('el perfil exige token', async () => {
            const respuesta = await request(app).get('/api/usuarios/perfil');

            expect(respuesta.statusCode).toBe(401);
        });

        test('rechaza editar el perfil sin datos, con nombre vacío o con correo inválido', async () => {
            const vacio = await request(app).put('/api/usuarios/perfil').set(autorizar(token)).send({});
            const nombre = await request(app).put('/api/usuarios/perfil').set(autorizar(token)).send({ nombre: '  ' });
            const correo = await request(app).put('/api/usuarios/perfil').set(autorizar(token)).send({ correo: 'no-es-correo' });

            expect(vacio.statusCode).toBe(400);
            expect(nombre.statusCode).toBe(400);
            expect(correo.statusCode).toBe(400);
        });

        test('rechaza usar el correo de otro usuario', async () => {
            const respuesta = await request(app)
                .put('/api/usuarios/perfil')
                .set(autorizar(token))
                .send({ correo: correoSecundario });

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.body.mensaje).toBe('El correo ya está registrado');
        });

        test('actualiza el nombre y entrega un token nuevo', async () => {
            const respuesta = await request(app)
                .put('/api/usuarios/perfil')
                .set(autorizar(token))
                .send({ nombre: 'Usuario QA Editado' });

            expect(respuesta.statusCode).toBe(200);
            expect(respuesta.body.usuario).toEqual({ id: idPrincipal, nombre: 'Usuario QA Editado', correo: correoPrincipal });
            expect(typeof respuesta.body.token).toBe('string');

            const perfil = await request(app).get('/api/usuarios/perfil').set(autorizar(respuesta.body.token));
            expect(perfil.body.nombre).toBe('Usuario QA Editado');
        });

        test('valida el cambio de contraseña', async () => {
            const faltan = await request(app).put('/api/usuarios/password').set(autorizar(token)).send({});
            const corta = await request(app)
                .put('/api/usuarios/password')
                .set(autorizar(token))
                .send({ passwordActual: passwordInicial, passwordNueva: '123' });
            const igual = await request(app)
                .put('/api/usuarios/password')
                .set(autorizar(token))
                .send({ passwordActual: passwordInicial, passwordNueva: passwordInicial });
            const incorrecta = await request(app)
                .put('/api/usuarios/password')
                .set(autorizar(token))
                .send({ passwordActual: 'no-es-esta', passwordNueva: passwordNueva });

            expect(faltan.statusCode).toBe(400);
            expect(corta.statusCode).toBe(400);
            expect(igual.statusCode).toBe(400);
            expect(incorrecta.statusCode).toBe(401);
        });

        test('cambia la contraseña: la anterior deja de servir y la nueva funciona', async () => {
            const cambio = await request(app)
                .put('/api/usuarios/password')
                .set(autorizar(token))
                .send({ passwordActual: passwordInicial, passwordNueva });

            const viejo = await request(app)
                .post('/api/usuarios/login')
                .send({ correo: correoPrincipal, password: passwordInicial });
            const nuevo = await request(app)
                .post('/api/usuarios/login')
                .send({ correo: correoPrincipal, password: passwordNueva });

            expect(cambio.statusCode).toBe(200);
            expect(viejo.statusCode).toBe(401);
            expect(nuevo.statusCode).toBe(200);
        });

        test('eliminar la cuenta exige la contraseña correcta', async () => {
            const sin = await request(app).delete('/api/usuarios/cuenta').set(autorizar(token)).send({});
            const mala = await request(app)
                .delete('/api/usuarios/cuenta')
                .set(autorizar(token))
                .send({ password: 'equivocada' });

            expect(sin.statusCode).toBe(400);
            expect(mala.statusCode).toBe(401);
        });

        test('eliminar la cuenta borra también sus ingresos y gastos', async () => {
            const respuesta = await request(app)
                .delete('/api/usuarios/cuenta')
                .set(autorizar(token))
                .send({ password: passwordNueva });

            expect(respuesta.statusCode).toBe(200);

            const [ingresos] = await pool.query('SELECT COUNT(*) AS total FROM ingresos WHERE usuario_id = ?', [idPrincipal]);
            const [gastos] = await pool.query('SELECT COUNT(*) AS total FROM gastos WHERE usuario_id = ?', [idPrincipal]);
            const login = await request(app)
                .post('/api/usuarios/login')
                .send({ correo: correoPrincipal, password: passwordNueva });
            const perfil = await request(app).get('/api/usuarios/perfil').set(autorizar(token));

            expect(Number(ingresos[0].total)).toBe(0);
            expect(Number(gastos[0].total)).toBe(0);
            expect(login.statusCode).toBe(401);
            expect(perfil.statusCode).toBe(404);
        });
    });

    describe('errores generales', () => {
        test('una ruta inexistente responde 404 en JSON', async () => {
            const respuesta = await request(app).get('/api/no-existe');

            expect(respuesta.statusCode).toBe(404);
            expect(respuesta.body.mensaje).toBe('Ruta no encontrada');
        });

        test('un JSON mal formado responde 400 en JSON', async () => {
            const respuesta = await request(app)
                .post('/api/usuarios/login')
                .set('Content-Type', 'application/json')
                .send('{"correo": ');

            expect(respuesta.statusCode).toBe(400);
            expect(respuesta.body.mensaje).toBe('El cuerpo de la solicitud no es un JSON válido');
        });

        test('no revela la tecnología del servidor', async () => {
            const respuesta = await request(app).get('/');

            expect(respuesta.headers['x-powered-by']).toBeUndefined();
        });
    });
});
