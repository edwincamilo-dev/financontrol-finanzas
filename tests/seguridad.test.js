// Pruebas de seguridad: cabeceras (helmet + CSP), límite de intentos y validación de JWT_SECRET.

const request = require('supertest');

const app = require('../src/server');
const pool = require('../src/config/database');
const { validarJwtSecret, LARGO_MINIMO_JWT_SECRET } = require('../src/config/seguridad');
const { leerConfiguracion, MENSAJE } = require('../src/middleware/limites');

afterAll(() => pool.end());

describe('Cabeceras de seguridad', () => {
    test('las respuestas incluyen Content-Security-Policy y X-Content-Type-Options', async () => {
        const respuesta = await request(app).get('/api/saldo');

        expect(respuesta.status).toBe(401);
        expect(respuesta.headers['x-content-type-options']).toBe('nosniff');

        const csp = respuesta.headers['content-security-policy'];

        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self'");
        expect(csp).toContain('https://fonts.googleapis.com');
        expect(csp).toContain('https://fonts.gstatic.com');
        expect(csp).toContain("img-src 'self' data:");
        expect(csp).not.toContain('unsafe-inline');
    });

    test('los archivos del frontend también llevan las cabeceras', async () => {
        const respuesta = await request(app).get('/js/app.js');

        expect(respuesta.status).toBe(200);
        expect(respuesta.headers['content-security-policy']).toBeDefined();
        expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    });

    test('no se anuncia el servidor con X-Powered-By', async () => {
        const respuesta = await request(app).get('/api/saldo');

        expect(respuesta.headers['x-powered-by']).toBeUndefined();
    });

    test('/api-docs usa su propia CSP con un nonce distinto en cada respuesta', async () => {
        const primera = await request(app).get('/api-docs');
        const segunda = await request(app).get('/api-docs');
        const csp = primera.headers['content-security-policy'];
        const nonce = /'nonce-([^']+)'/.exec(csp)[1];

        expect(csp).toContain('https://cdn.jsdelivr.net');
        expect(csp).not.toContain('unsafe-inline');
        expect(primera.text).toContain(`<script nonce="${nonce}">`);
        expect(primera.text).toContain(`<style nonce="${nonce}">`);
        expect(primera.text).not.toMatch(/\son\w+="/); // sin manejadores en línea (onerror=...)
        expect(segunda.headers['content-security-policy']).not.toContain(nonce);
    });
});

describe('Límite de intentos', () => {
    test('se desactiva con NODE_ENV=test o RATE_LIMIT_DESACTIVADO=true', () => {
        expect(leerConfiguracion({ NODE_ENV: 'test' }).desactivado).toBe(true);
        expect(leerConfiguracion({ RATE_LIMIT_DESACTIVADO: 'true' }).desactivado).toBe(true);
        expect(leerConfiguracion({ NODE_ENV: 'production' }).desactivado).toBe(false);
    });

    test('usa 5 intentos cada 15 minutos por defecto y lee los valores del .env', () => {
        expect(leerConfiguracion({})).toMatchObject({ maxLogin: 5, ventanaMin: 15 });
        expect(leerConfiguracion({ RATE_LIMIT_LOGIN_MAX: '3', RATE_LIMIT_VENTANA_MIN: '1' })).toMatchObject({ maxLogin: 3, ventanaMin: 1 });
        expect(leerConfiguracion({ RATE_LIMIT_LOGIN_MAX: 'abc' }).maxLogin).toBe(5);
    });

    describe('con el límite activado', () => {
        let appLimitada;
        let poolLimitado;
        const VARIABLES = {
            NODE_ENV: 'development',
            RATE_LIMIT_DESACTIVADO: 'false',
            RATE_LIMIT_LOGIN_MAX: '5',
            RATE_LIMIT_VENTANA_MIN: '15'
        };

        beforeAll(() => {
            // Se carga una copia aparte del servidor con el límite encendido (Jest lo apaga por defecto).
            const anteriores = Object.fromEntries(Object.keys(VARIABLES).map((clave) => [clave, process.env[clave]]));

            Object.assign(process.env, VARIABLES);

            jest.isolateModules(() => {
                appLimitada = require('../src/server');
                poolLimitado = require('../src/config/database');
            });

            for (const [clave, valor] of Object.entries(anteriores)) {
                if (valor === undefined) delete process.env[clave];
                else process.env[clave] = valor;
            }
        });

        afterAll(() => poolLimitado.end());

        test('el sexto login fallido responde 429 con el mensaje esperado', async () => {
            const correo = `qa.limite.${Date.now()}@financontrol.test`;
            const intentar = () => request(appLimitada)
                .post('/api/usuarios/login')
                .send({ correo, password: 'incorrecta' });

            // Con MySQL encendido son 401 (credenciales incorrectas); sin base de datos, 500.
            // Para el límite ambos cuentan como intento fallido: lo que se prueba es el sexto.
            for (let intento = 1; intento <= 5; intento++) {
                const respuesta = await intentar();

                expect([401, 500]).toContain(respuesta.status);
            }

            const sexto = await intentar();

            expect(sexto.status).toBe(429);
            expect(sexto.body).toEqual({ mensaje: MENSAJE });
            expect(sexto.body.mensaje).toBe('Demasiados intentos. Intenta de nuevo en unos minutos.');
        });

        test('el bloqueo es por correo: otra cuenta desde la misma IP sigue pudiendo intentar', async () => {
            const respuesta = await request(appLimitada)
                .post('/api/usuarios/login')
                .send({ correo: `qa.otro.${Date.now()}@financontrol.test`, password: 'incorrecta' });

            expect(respuesta.status).not.toBe(429);
            expect([401, 500]).toContain(respuesta.status);
        });
    });
});

describe('Validación de JWT_SECRET al arrancar', () => {
    test('rechaza un secreto ausente', () => {
        expect(validarJwtSecret(undefined)).toMatch(/falta la variable JWT_SECRET/);
        expect(validarJwtSecret('   ')).toMatch(/falta la variable JWT_SECRET/);
    });

    test('rechaza un secreto corto y explica cómo generar uno', () => {
        const mensaje = validarJwtSecret('secreto-de-26-caracteres!!');

        expect(mensaje).toMatch(/tiene 26 caracteres y debe tener al menos 32/);
        expect(mensaje).toContain("require('crypto').randomBytes(48).toString('hex')");
    });

    test('acepta un secreto de 32 caracteres o más', () => {
        expect(validarJwtSecret('a'.repeat(LARGO_MINIMO_JWT_SECRET))).toBeNull();
        expect(validarJwtSecret(require('crypto').randomBytes(48).toString('hex'))).toBeNull();
    });
});
