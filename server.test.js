const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('./server');
const pool = require('./database');

describe('API FinanControl', () => {

    let token;

    beforeAll(() => {
        token = jwt.sign(
            {
                id: 1,
                correo: 'juan@gmail.com'
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );
    });

    test('la API está funcionando', async () => {
        const respuesta = await request(app)
            .get('/');

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.body.mensaje).toBe('API FinanControl funcionando');
        expect(respuesta.body.baseDatos).toBe('Conectada');
    });

    test('rechaza el acceso cuando no se envía token', async () => {
        const respuesta = await request(app)
            .get('/api/prueba-seguridad');

        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.body.mensaje).toBe('Token requerido');
    });

    test('permite el acceso cuando se envía un token válido', async () => {
        const respuesta = await request(app)
            .get('/api/prueba-seguridad')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.body.mensaje).toBe('Acceso autorizado');
    });

    test('rechaza un token con formato incorrecto', async () => {
        const respuesta = await request(app)
            .get('/api/prueba-seguridad')
            .set('Authorization', 'Token incorrecto');

        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.body.mensaje).toBe('Formato de token inválido');
    });

    test('rechaza un token inválido', async () => {
        const respuesta = await request(app)
            .get('/api/prueba-seguridad')
            .set('Authorization', 'Bearer token-invalido');

        expect(respuesta.statusCode).toBe(401);
        expect(respuesta.body.mensaje).toBe('Token inválido');
    });

    test('rechaza registrar un ingreso sin datos obligatorios', async () => {
        const respuesta = await request(app)
            .post('/api/ingresos')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'Descripción, valor y fecha son obligatorios'
        );
    });

    test('rechaza un ingreso con valor igual a 0', async () => {
        const respuesta = await request(app)
            .post('/api/ingresos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                descripcion: 'Ingreso de prueba',
                valor: 0,
                fecha: '2026-09-28'
            });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'El valor debe ser mayor que 0'
        );
    });

    test('rechaza un ingreso con valor negativo', async () => {
        const respuesta = await request(app)
            .post('/api/ingresos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                descripcion: 'Ingreso negativo',
                valor: -1000,
                fecha: '2026-09-28'
            });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'El valor debe ser mayor que 0'
        );
    });

    test('rechaza registrar un gasto sin datos obligatorios', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('Authorization', `Bearer ${token}`)
            .send({});

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'Descripción, valor, categoría y fecha son obligatorios'
        );
    });

    test('rechaza un gasto con valor igual a 0', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                descripcion: 'Gasto de prueba',
                valor: 0,
                categoria: 'Prueba',
                fecha: '2026-09-28'
            });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'El valor debe ser mayor que 0'
        );
    });

    test('rechaza un gasto con valor negativo', async () => {
        const respuesta = await request(app)
            .post('/api/gastos')
            .set('Authorization', `Bearer ${token}`)
            .send({
                descripcion: 'Gasto negativo',
                valor: -5000,
                categoria: 'Prueba',
                fecha: '2026-09-28'
            });

        expect(respuesta.statusCode).toBe(400);
        expect(respuesta.body.mensaje).toBe(
            'El valor debe ser mayor que 0'
        );
    });

    test('consulta los ingresos del usuario', async () => {
        const respuesta = await request(app)
            .get('/api/ingresos')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(200);
        expect(Array.isArray(respuesta.body)).toBe(true);
    });

    test('consulta un ingreso que no existe', async () => {
        const respuesta = await request(app)
            .get('/api/ingresos/999999')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.body.mensaje).toBe('Ingreso no encontrado');
    });

    test('consulta los gastos del usuario', async () => {
        const respuesta = await request(app)
            .get('/api/gastos')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(200);
        expect(Array.isArray(respuesta.body)).toBe(true);
    });

    test('consulta gastos por categoría', async () => {
        const respuesta = await request(app)
            .get('/api/gastos/categoria/Alimentación')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(200);
        expect(Array.isArray(respuesta.body)).toBe(true);
    });

    test('consulta un gasto que no existe', async () => {
        const respuesta = await request(app)
            .get('/api/gastos/999999')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(404);
        expect(respuesta.body.mensaje).toBe('Gasto no encontrado');
    });

    test('consulta el saldo del usuario', async () => {
        const respuesta = await request(app)
            .get('/api/saldo')
            .set('Authorization', `Bearer ${token}`);

        expect(respuesta.statusCode).toBe(200);
        expect(respuesta.body).toHaveProperty('totalIngresos');
        expect(respuesta.body).toHaveProperty('totalGastos');
        expect(respuesta.body).toHaveProperty('saldo');
    });

    afterAll(async () => {
        await pool.end();
    });

});