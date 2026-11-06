// Pruebas de la política CORS (src/middleware/cors.js).
// No necesitan base de datos: todas las respuestas se deciden antes de llegar a las rutas.

const request = require('supertest');

const app = require('../src/server');

const PERMITIDO = 'http://localhost:3000';
const NO_PERMITIDO = 'http://sitio-malicioso.com';

describe('CORS', () => {
    const originalAllowed = process.env.ALLOWED_ORIGINS;
    const originalExigir = process.env.CORS_EXIGIR_ORIGEN;

    beforeEach(() => {
        delete process.env.ALLOWED_ORIGINS;
        delete process.env.CORS_EXIGIR_ORIGEN;
    });

    afterAll(() => {
        if (originalAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
        else process.env.ALLOWED_ORIGINS = originalAllowed;

        if (originalExigir === undefined) delete process.env.CORS_EXIGIR_ORIGEN;
        else process.env.CORS_EXIGIR_ORIGEN = originalExigir;
    });

    test('un origen permitido recibe las cabeceras Access-Control-*', async () => {
        const respuesta = await request(app)
            .get('/api/saldo')
            .set('Origin', PERMITIDO);

        // 401 porque no lleva token: lo importante es que CORS lo dejó pasar
        expect(respuesta.status).toBe(401);
        expect(respuesta.headers['access-control-allow-origin']).toBe(PERMITIDO);
        expect(respuesta.headers['access-control-expose-headers']).toContain('X-Cache');
        expect(respuesta.headers.vary).toContain('Origin');
    });

    test('un origen NO permitido es bloqueado con 403 y sin cabeceras Access-Control-*', async () => {
        const respuesta = await request(app)
            .get('/api/saldo')
            .set('Origin', NO_PERMITIDO);

        expect(respuesta.status).toBe(403);
        expect(respuesta.body.mensaje).toMatch(/CORS/);
        expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('el origen "null" (archivo abierto desde el disco) también se bloquea', async () => {
        const respuesta = await request(app)
            .get('/api/saldo')
            .set('Origin', 'null');

        expect(respuesta.status).toBe(403);
    });

    test('bloquea el origen aunque la ruta sea pública', async () => {
        const respuesta = await request(app)
            .post('/api/usuarios/login')
            .set('Origin', NO_PERMITIDO)
            .send({ correo: 'a@a.com', password: 'x' });

        expect(respuesta.status).toBe(403);
    });

    test('el preflight (OPTIONS) de un origen permitido responde 204 con lo que se permite', async () => {
        const respuesta = await request(app)
            .options('/api/ingresos')
            .set('Origin', PERMITIDO)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'authorization,content-type');

        expect(respuesta.status).toBe(204);
        expect(respuesta.headers['access-control-allow-origin']).toBe(PERMITIDO);
        expect(respuesta.headers['access-control-allow-methods']).toContain('POST');
        expect(respuesta.headers['access-control-allow-headers']).toContain('Authorization');
    });

    test('el preflight de un origen NO permitido responde 403', async () => {
        const respuesta = await request(app)
            .options('/api/ingresos')
            .set('Origin', NO_PERMITIDO)
            .set('Access-Control-Request-Method', 'POST');

        expect(respuesta.status).toBe(403);
        expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('ALLOWED_ORIGINS acepta varios orígenes separados por comas', async () => {
        process.env.ALLOWED_ORIGINS = 'https://app.ejemplo.com, https://otra.ejemplo.com/';

        const uno = await request(app).get('/api/saldo').set('Origin', 'https://app.ejemplo.com');
        const dos = await request(app).get('/api/saldo').set('Origin', 'https://otra.ejemplo.com');
        const tres = await request(app).get('/api/saldo').set('Origin', PERMITIDO);

        expect(uno.status).toBe(401);
        expect(dos.status).toBe(401);
        // Al definir la lista se reemplaza la de por defecto (salvo el origen propio)
        expect(tres.status).toBe(403);
    });

    test('las peticiones sin Origin (Postman, curl, Cypress) pasan por defecto', async () => {
        const respuesta = await request(app).get('/api/saldo');

        expect(respuesta.status).toBe(401);
        expect(respuesta.headers['access-control-allow-origin']).toBeUndefined();
    });

    test('con CORS_EXIGIR_ORIGEN=true también se bloquean las peticiones sin Origin', async () => {
        process.env.CORS_EXIGIR_ORIGEN = 'true';

        const sinOrigen = await request(app).get('/api/saldo');
        const conOrigen = await request(app).get('/api/saldo').set('Origin', PERMITIDO);

        expect(sinOrigen.status).toBe(403);
        expect(conOrigen.status).toBe(401);
    });
});
