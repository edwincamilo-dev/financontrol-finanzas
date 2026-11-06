// Pruebas de la documentación Swagger (/api-docs) y de la página principal.
// No necesitan base de datos.

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../src/server');

describe('Documentación Swagger', () => {
    test('GET /api-docs entrega la página de Swagger UI', async () => {
        const respuesta = await request(app).get('/api-docs');

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers['content-type']).toMatch(/text\/html/);
        expect(respuesta.text).toContain('swagger-ui');
        expect(respuesta.text).toContain('/api-docs/openapi.json');
    });

    test('GET /api-docs/openapi.json entrega el contrato completo', async () => {
        const respuesta = await request(app).get('/api-docs/openapi.json');

        expect(respuesta.status).toBe(200);
        expect(respuesta.body.openapi).toMatch(/^3\./);
        expect(respuesta.body.info.title).toBe('FinanControl API');

        const operaciones = Object.values(respuesta.body.paths)
            .reduce((suma, metodos) => suma + Object.keys(metodos).length, 0);

        expect(operaciones).toBe(27);
    });

    test('el contrato publicado apunta al servidor desde el que se consulta', async () => {
        const respuesta = await request(app).get('/api-docs/openapi.json');

        expect(respuesta.body.servers).toHaveLength(1);
        expect(respuesta.body.servers[0].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    });

    test('el origen no permitido tampoco puede leer la documentación desde un navegador', async () => {
        const respuesta = await request(app)
            .get('/api-docs/openapi.json')
            .set('Origin', 'http://sitio-malicioso.com');

        expect(respuesta.status).toBe(403);
    });
});

describe('Página principal', () => {
    test('un cliente que pide JSON recibe el estado de la API', async () => {
        const archivo = path.join(__dirname, '..', 'public', 'index.html');

        expect(fs.existsSync(archivo)).toBe(true);

        // Sin base de datos el estado es 500, pero sigue siendo JSON (no la página web)
        const respuesta = await request(app).get('/').set('Accept', 'application/json');

        expect(respuesta.headers['content-type']).toMatch(/json/);
        expect(respuesta.body.mensaje).toBeDefined();
    });

    test('un navegador (Accept: text/html) recibe la aplicación web', async () => {
        const respuesta = await request(app)
            .get('/')
            .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers['content-type']).toMatch(/text\/html/);
        expect(respuesta.text).toContain('FinanControl');
    });

    test('los archivos estáticos del frontend se sirven desde /', async () => {
        const css = await request(app).get('/css/styles.css');
        const js = await request(app).get('/js/app.js');

        expect(css.status).toBe(200);
        expect(css.headers['content-type']).toMatch(/css/);
        expect(js.status).toBe(200);
        expect(js.headers['content-type']).toMatch(/javascript/);
    });
});
