// Pruebas de contrato: comprueban que docs/openapi.json describe la API tal como es.
//  1) Cada ruta del código está documentada, y cada ruta documentada existe.
//  2) Las respuestas reales cumplen el esquema (y el código HTTP) del contrato.

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const app = require('../src/server');
const pool = require('../src/config/database');
const cache = require('../src/middleware/cache');

const contrato = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'openapi.json'), 'utf8'));

// ---------- 1. Rutas del código vs. contrato ----------

// Dónde se monta cada archivo de src/routes (si agrega uno nuevo, regístrelo aquí).
const PREFIJOS = {
    'perfil.js': '/api/usuarios',
    'movimientos.js': '/api/movimientos',
    'resumen.js': '/api/resumen',
    'categorias.js': '',
    'cache.js': ''
};

function rutasDelCodigo() {
    const raiz = path.join(__dirname, '..', 'src');
    const archivos = [{ ruta: path.join(raiz, 'server.js'), prefijo: '', objeto: 'app' }];

    for (const nombre of fs.readdirSync(path.join(raiz, 'routes'))) {
        if (!(nombre in PREFIJOS)) {
            throw new Error(`src/routes/${nombre} no está registrado en PREFIJOS (tests/contrato.test.js)`);
        }

        archivos.push({ ruta: path.join(raiz, 'routes', nombre), prefijo: PREFIJOS[nombre], objeto: 'router' });
    }

    const encontradas = new Set();

    for (const { ruta, prefijo, objeto } of archivos) {
        const codigo = fs.readFileSync(ruta, 'utf8');
        const patron = new RegExp(`${objeto}\\.(get|post|put|delete)\\(\\s*'([^']*)'`, 'g');
        let coincidencia;

        while ((coincidencia = patron.exec(codigo)) !== null) {
            const rutaCompleta = (prefijo + (coincidencia[2] === '/' ? '' : coincidencia[2])) || '/';

            encontradas.add(`${coincidencia[1].toUpperCase()} ${rutaCompleta.replace(/:(\w+)/g, '{$1}')}`);
        }
    }

    return encontradas;
}

function rutasDelContrato() {
    const documentadas = new Set();

    for (const [ruta, operaciones] of Object.entries(contrato.paths)) {
        for (const metodo of Object.keys(operaciones)) {
            documentadas.add(`${metodo.toUpperCase()} ${ruta}`);
        }
    }

    return documentadas;
}

// ---------- 2. Validador mínimo de esquemas ----------

function resolver(esquema) {
    if (esquema.$ref) {
        return contrato.components.schemas[esquema.$ref.split('/').pop()];
    }

    return esquema;
}

function tipoDe(valor) {
    if (valor === null) return 'null';
    if (Array.isArray(valor)) return 'array';
    if (Number.isInteger(valor)) return 'integer';

    return typeof valor;
}

function validar(valor, esquemaOriginal, ubicacion = 'cuerpo') {
    const esquema = resolver(esquemaOriginal);
    const errores = [];
    const tipos = [].concat(esquema.type || []);
    const real = tipoDe(valor);

    if (tipos.length > 0 && !tipos.includes(real) && !(real === 'integer' && tipos.includes('number'))) {
        return [`${ubicacion}: se esperaba ${tipos.join('|')} y llegó ${real}`];
    }

    if (esquema.enum && !esquema.enum.includes(valor)) {
        errores.push(`${ubicacion}: "${valor}" no está en [${esquema.enum.join(', ')}]`);
    }

    if (esquema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        errores.push(`${ubicacion}: "${valor}" no es una fecha AAAA-MM-DD`);
    }

    if (real === 'object') {
        for (const campo of esquema.required || []) {
            if (!(campo in valor)) {
                errores.push(`${ubicacion}: falta el campo "${campo}"`);
            }
        }

        for (const [campo, sub] of Object.entries(esquema.properties || {})) {
            if (campo in valor) {
                errores.push(...validar(valor[campo], sub, `${ubicacion}.${campo}`));
            }
        }
    }

    if (real === 'array') {
        if (esquema.minItems !== undefined && valor.length < esquema.minItems) {
            errores.push(`${ubicacion}: tiene ${valor.length} elementos y se esperaban al menos ${esquema.minItems}`);
        }

        if (esquema.maxItems !== undefined && valor.length > esquema.maxItems) {
            errores.push(`${ubicacion}: tiene ${valor.length} elementos y se esperaban máximo ${esquema.maxItems}`);
        }

        valor.forEach((elemento, i) => errores.push(...validar(elemento, esquema.items, `${ubicacion}[${i}]`)));
    }

    return errores;
}

// Comprueba que el código HTTP esté documentado y que el cuerpo cumpla el esquema.
function cumpleContrato(respuesta, metodo, rutaDocumentada) {
    const operacion = contrato.paths[rutaDocumentada][metodo];
    const documentada = operacion.responses[String(respuesta.statusCode)];

    if (!documentada) {
        return [`${metodo.toUpperCase()} ${rutaDocumentada}: el código ${respuesta.statusCode} no está documentado`];
    }

    const contenido = documentada.content && documentada.content['application/json'];

    return contenido ? validar(respuesta.body, contenido.schema) : [];
}

// ---------- Pruebas ----------

describe('contrato de la API (docs/openapi.json)', () => {

    describe('el contrato y el código están sincronizados', () => {
        test('todas las rutas del código están documentadas', () => {
            const documentadas = rutasDelContrato();
            const sinDocumentar = [...rutasDelCodigo()].filter((r) => !documentadas.has(r));

            expect(sinDocumentar).toEqual([]);
        });

        test('todas las rutas documentadas existen en el código', () => {
            const codigo = rutasDelCodigo();
            const sobrantes = [...rutasDelContrato()].filter((r) => !codigo.has(r));

            expect(sobrantes).toEqual([]);
        });

        test('el contrato tiene los datos básicos de OpenAPI', () => {
            expect(contrato.openapi).toMatch(/^3\.1/);
            expect(contrato.info.title).toBe('FinanControl API');
            expect(Object.keys(contrato.components.schemas).length).toBeGreaterThan(10);
        });

        test('todas las referencias $ref apuntan a un esquema que existe', () => {
            const textos = JSON.stringify(contrato).match(/#\/components\/schemas\/\w+/g) || [];
            const faltantes = textos.filter((r) => !contrato.components.schemas[r.split('/').pop()]);

            expect(faltantes).toEqual([]);
        });

        test('toda operación protegida documenta el error 401', () => {
            const sin401 = [];

            for (const [ruta, operaciones] of Object.entries(contrato.paths)) {
                for (const [metodo, operacion] of Object.entries(operaciones)) {
                    if (operacion.security && !operacion.responses['401']) {
                        sin401.push(`${metodo.toUpperCase()} ${ruta}`);
                    }
                }
            }

            expect(sin401).toEqual([]);
        });
    });

    describe('las respuestas reales cumplen el contrato', () => {
        const sufijo = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
        const correo = `qa.contrato.${sufijo}@financontrol.test`;
        const password = 'Clave-Contrato-1';
        const auth = () => ({ Authorization: `Bearer ${token}` });
        let token;
        let idIngreso;
        let idGasto;

        beforeAll(async () => {
            cache.reiniciar();
        });

        afterAll(async () => {
            await pool.query('DELETE FROM ingresos WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo = ?)', [correo]);
            await pool.query('DELETE FROM gastos WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo = ?)', [correo]);
            await pool.query('DELETE FROM usuarios WHERE correo = ?', [correo]);
            await pool.end();
        });

        test('el validador detecta incumplimientos (prueba del propio validador)', () => {
            expect(validar({ id: 'x' }, { $ref: '#/components/schemas/Perfil' })).not.toEqual([]);
            expect(validar({ id: 1, nombre: 'a', correo: 'b' }, { $ref: '#/components/schemas/Perfil' })).toEqual([]);
            expect(validar({ id: 1, nombre: 'a' }, { $ref: '#/components/schemas/Perfil' })).toEqual(['cuerpo: falta el campo "correo"']);
        });

        test('POST /api/usuarios/registro y /login', async () => {
            const registro = await request(app).post('/api/usuarios/registro').send({ nombre: 'QA Contrato', correo, password });
            const faltan = await request(app).post('/api/usuarios/registro').send({});
            const login = await request(app).post('/api/usuarios/login').send({ correo, password });
            const mala = await request(app).post('/api/usuarios/login').send({ correo, password: 'mala' });

            token = login.body.token;

            expect(cumpleContrato(registro, 'post', '/api/usuarios/registro')).toEqual([]);
            expect(cumpleContrato(faltan, 'post', '/api/usuarios/registro')).toEqual([]);
            expect(cumpleContrato(login, 'post', '/api/usuarios/login')).toEqual([]);
            expect(cumpleContrato(mala, 'post', '/api/usuarios/login')).toEqual([]);
        });

        test('GET y PUT /api/usuarios/perfil', async () => {
            const consulta = await request(app).get('/api/usuarios/perfil').set(auth());
            const edicion = await request(app).put('/api/usuarios/perfil').set(auth()).send({ nombre: 'QA Editado' });
            const invalido = await request(app).put('/api/usuarios/perfil').set(auth()).send({});
            const sinToken = await request(app).get('/api/usuarios/perfil');

            expect(cumpleContrato(consulta, 'get', '/api/usuarios/perfil')).toEqual([]);
            expect(cumpleContrato(edicion, 'put', '/api/usuarios/perfil')).toEqual([]);
            expect(cumpleContrato(invalido, 'put', '/api/usuarios/perfil')).toEqual([]);
            expect(cumpleContrato(sinToken, 'get', '/api/usuarios/perfil')).toEqual([]);
        });

        test('GET /api/prueba-seguridad y GET /', async () => {
            const seguridad = await request(app).get('/api/prueba-seguridad').set(auth());
            const estado = await request(app).get('/');

            expect(cumpleContrato(seguridad, 'get', '/api/prueba-seguridad')).toEqual([]);
            expect(cumpleContrato(estado, 'get', '/')).toEqual([]);
        });

        test('CRUD de ingresos', async () => {
            const nuevo = { descripcion: 'Salario', valor: 1000000, fecha: '2026-01-10' };
            const crear = await request(app).post('/api/ingresos').set(auth()).send(nuevo);
            const invalido = await request(app).post('/api/ingresos').set(auth()).send({});

            idIngreso = crear.body.id;

            const lista = await request(app).get('/api/ingresos?pagina=1&limite=5').set(auth());
            const uno = await request(app).get(`/api/ingresos/${idIngreso}`).set(auth());
            const noExiste = await request(app).get('/api/ingresos/99999999').set(auth());
            const filtro = await request(app).get('/api/ingresos?desde=hoy').set(auth());
            const editar = await request(app).put(`/api/ingresos/${idIngreso}`).set(auth()).send({ ...nuevo, valor: 1100000 });

            expect(cumpleContrato(crear, 'post', '/api/ingresos')).toEqual([]);
            expect(cumpleContrato(invalido, 'post', '/api/ingresos')).toEqual([]);
            expect(cumpleContrato(lista, 'get', '/api/ingresos')).toEqual([]);
            expect(cumpleContrato(uno, 'get', '/api/ingresos/{id}')).toEqual([]);
            expect(cumpleContrato(noExiste, 'get', '/api/ingresos/{id}')).toEqual([]);
            expect(cumpleContrato(filtro, 'get', '/api/ingresos')).toEqual([]);
            expect(cumpleContrato(editar, 'put', '/api/ingresos/{id}')).toEqual([]);
        });

        test('CRUD de gastos y categorías', async () => {
            const nuevo = { descripcion: 'Mercado', valor: 150000, categoria: 'Alimentación', fecha: '2026-01-12' };
            const crear = await request(app).post('/api/gastos').set(auth()).send(nuevo);

            idGasto = crear.body.id;

            const lista = await request(app).get('/api/gastos').set(auth());
            const uno = await request(app).get(`/api/gastos/${idGasto}`).set(auth());
            const porCategoria = await request(app).get(`/api/gastos/categoria/${encodeURIComponent('Alimentación')}`).set(auth());
            const categorias = await request(app).get('/api/gastos/categorias').set(auth());
            const editar = await request(app).put(`/api/gastos/${idGasto}`).set(auth()).send({ ...nuevo, valor: 160000 });

            expect(cumpleContrato(crear, 'post', '/api/gastos')).toEqual([]);
            expect(cumpleContrato(lista, 'get', '/api/gastos')).toEqual([]);
            expect(cumpleContrato(uno, 'get', '/api/gastos/{id}')).toEqual([]);
            expect(cumpleContrato(porCategoria, 'get', '/api/gastos/categoria/{categoria}')).toEqual([]);
            expect(cumpleContrato(categorias, 'get', '/api/gastos/categorias')).toEqual([]);
            expect(cumpleContrato(editar, 'put', '/api/gastos/{id}')).toEqual([]);
        });

        test('saldo, movimientos y resúmenes', async () => {
            const saldo = await request(app).get('/api/saldo').set(auth());
            const movimientos = await request(app).get('/api/movimientos').set(auth());
            const tipoMalo = await request(app).get('/api/movimientos?tipo=otro').set(auth());
            const resumen = await request(app).get('/api/resumen?desde=2026-01-01&hasta=2026-12-31').set(auth());
            const mensual = await request(app).get('/api/resumen/mensual?anio=2026').set(auth());
            const anioMalo = await request(app).get('/api/resumen/mensual?anio=abc').set(auth());
            const exportar = await request(app).get('/api/movimientos/exportar').set(auth());

            expect(cumpleContrato(saldo, 'get', '/api/saldo')).toEqual([]);
            expect(cumpleContrato(movimientos, 'get', '/api/movimientos')).toEqual([]);
            expect(cumpleContrato(tipoMalo, 'get', '/api/movimientos')).toEqual([]);
            expect(cumpleContrato(resumen, 'get', '/api/resumen')).toEqual([]);
            expect(cumpleContrato(mensual, 'get', '/api/resumen/mensual')).toEqual([]);
            expect(cumpleContrato(anioMalo, 'get', '/api/resumen/mensual')).toEqual([]);
            expect(cumpleContrato(exportar, 'get', '/api/movimientos/exportar')).toEqual([]);
            expect(exportar.headers['content-type']).toMatch(/text\/csv/);
        });

        test('las respuestas documentan las cabeceras de caché y paginación que entregan', async () => {
            const pagina = await request(app).get('/api/gastos?pagina=1&limite=1').set(auth());
            const cabecerasDocumentadas = Object.keys(contrato.paths['/api/gastos'].get.responses['200'].headers);

            for (const cabecera of ['x-total-count', 'x-page', 'x-limit', 'x-cache', 'etag']) {
                expect(pagina.headers[cabecera]).toBeDefined();
                expect(cabecerasDocumentadas.map((c) => c.toLowerCase())).toContain(cabecera);
            }
        });

        test('caché: estadísticas e invalidación', async () => {
            const estadisticas = await request(app).get('/api/cache/estadisticas').set(auth());
            const invalidar = await request(app).delete('/api/cache').set(auth());

            expect(cumpleContrato(estadisticas, 'get', '/api/cache/estadisticas')).toEqual([]);
            expect(cumpleContrato(invalidar, 'delete', '/api/cache')).toEqual([]);
        });

        test('DELETE de gasto e ingreso', async () => {
            const gasto = await request(app).delete(`/api/gastos/${idGasto}`).set(auth());
            const gastoOtraVez = await request(app).delete(`/api/gastos/${idGasto}`).set(auth());
            const ingreso = await request(app).delete(`/api/ingresos/${idIngreso}`).set(auth());

            expect(cumpleContrato(gasto, 'delete', '/api/gastos/{id}')).toEqual([]);
            expect(cumpleContrato(gastoOtraVez, 'delete', '/api/gastos/{id}')).toEqual([]);
            expect(cumpleContrato(ingreso, 'delete', '/api/ingresos/{id}')).toEqual([]);
        });

        test('PUT /password y DELETE /cuenta', async () => {
            const corta = await request(app).put('/api/usuarios/password').set(auth()).send({ passwordActual: password, passwordNueva: '1' });
            const cambio = await request(app).put('/api/usuarios/password').set(auth()).send({ passwordActual: password, passwordNueva: 'Clave-Nueva-9' });
            const sinClave = await request(app).delete('/api/usuarios/cuenta').set(auth()).send({});
            const cuenta = await request(app).delete('/api/usuarios/cuenta').set(auth()).send({ password: 'Clave-Nueva-9' });

            expect(cumpleContrato(corta, 'put', '/api/usuarios/password')).toEqual([]);
            expect(cumpleContrato(cambio, 'put', '/api/usuarios/password')).toEqual([]);
            expect(cumpleContrato(sinClave, 'delete', '/api/usuarios/cuenta')).toEqual([]);
            expect(cumpleContrato(cuenta, 'delete', '/api/usuarios/cuenta')).toEqual([]);
        });
    });
});
