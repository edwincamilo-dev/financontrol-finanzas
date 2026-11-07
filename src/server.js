require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('./config/database');
const verificarToken = require('./middleware/auth');
const cacheMiddleware = require('./middleware/cache');
const { crearLimitadores } = require('./middleware/limites');
const { DIRECTIVAS_CSP } = require('./config/seguridad');
const {
    esFechaValida,
    leerRangoFechas,
    leerPaginacion,
    condicionesBase,
    normalizarMovimiento
} = require('./utils/filtros');

const app = express();

app.disable('x-powered-by');

// Detrás del proxy HTTPS de un hosting (Render, Railway...) la IP real llega en X-Forwarded-For.
// TRUST_PROXY=true hace que Express confíe en ese primer proxy (lo necesita el límite de intentos).
if (['1', 'true'].includes(String(process.env.TRUST_PROXY).toLowerCase())) {
    app.set('trust proxy', 1);
}

// CORS: solo los orígenes de ALLOWED_ORIGINS (y el propio) pueden usar la API desde un navegador
app.use(require('./middleware/cors'));

// Cabeceras de seguridad (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy...).
// /api-docs reemplaza la CSP por una propia con nonce (ver src/docs/swagger.js).
app.use(helmet({
    contentSecurityPolicy: { useDefaults: true, directives: DIRECTIVAS_CSP },
    xPoweredBy: false // ya lo quita app.disable('x-powered-by')
}));

// Frontend (carpeta public/). Sin "index": la ruta "/" decide abajo entre página y JSON.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

app.use(express.json());

// Límite de intentos para login y registro (desactivado en pruebas, ver src/middleware/limites.js)
const limites = crearLimitadores();

// Caché de las consultas GET (se invalida solo al crear, editar o borrar)
app.use('/api', cacheMiddleware);

// Rutas que deben ir antes de las que usan /:id
app.use(require('./routes/cache'));
app.use(require('./routes/categorias'));

app.get('/', async (req, res) => {
    // Un navegador recibe la aplicación web; cualquier otro cliente (Postman, Cypress) recibe el JSON de estado.
    if (req.accepts(['json', 'html']) === 'html') {
        return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    }

    try {
        await pool.query('SELECT 1');

        res.json({
            mensaje: 'API FinanControl funcionando',
            baseDatos: 'Conectada'
        });
    } catch (error) {
        res.status(500).json({
            mensaje: 'Error de conexión con la base de datos'
        });
    }
});

app.post('/api/usuarios/registro', limites.registro, async (req, res) => {
    try {
        const { nombre, correo, password } = req.body;

        if (!nombre || !correo || !password) {
            return res.status(400).json({
                mensaje: 'Todos los campos son obligatorios'
            });
        }

        const [usuarios] = await pool.query(
            'SELECT id FROM usuarios WHERE correo = ?',
            [correo]
        );

        if (usuarios.length > 0) {
            return res.status(400).json({
                mensaje: 'El correo ya está registrado'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
            [nombre, correo, passwordHash]
        );

        res.status(201).json({
            mensaje: 'Usuario registrado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al registrar el usuario'
        });
    }
});

app.post('/api/usuarios/login', limites.login, async (req, res) => {
    try {
        const { correo, password } = req.body;

        if (!correo || !password) {
            return res.status(400).json({
                mensaje: 'Correo y contraseña son obligatorios'
            });
        }

        const [usuarios] = await pool.query(
            'SELECT * FROM usuarios WHERE correo = ?',
            [correo]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        const usuario = usuarios[0];

        const passwordCorrecta = await bcrypt.compare(
            password,
            usuario.password
        );

        if (!passwordCorrecta) {
            return res.status(401).json({
                mensaje: 'Correo o contraseña incorrectos'
            });
        }

        const token = jwt.sign(
            {
                id: usuario.id,
                correo: usuario.correo
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '2h'
            }
        );

        res.json({
            mensaje: 'Inicio de sesión correcto',
            token: token
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al iniciar sesión'
        });
    }
});

app.get('/api/prueba-seguridad', verificarToken, (req, res) => {
    res.json({
        mensaje: 'Acceso autorizado',
        usuario: req.usuario
    });
});

app.post('/api/ingresos', verificarToken, async (req, res) => {
    try {
        const { descripcion, valor, fecha } = req.body;

        if (!descripcion || valor === undefined || !fecha) {
            return res.status(400).json({
                mensaje: 'Descripción, valor y fecha son obligatorios'
            });
        }

        if (!(Number(valor) > 0)) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
            });
        }

        if (!esFechaValida(fecha)) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida. Use el formato AAAA-MM-DD'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO ingresos
            (descripcion, valor, fecha, usuario_id)
            VALUES (?, ?, ?, ?)`,
            [descripcion, valor, fecha, req.usuario.id]
        );

        res.status(201).json({
            mensaje: 'Ingreso registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al registrar el ingreso'
        });
    }
});

app.get('/api/ingresos', verificarToken, async (req, res) => {
    try {
        const rango = leerRangoFechas(req.query);

        if (rango.error) {
            return res.status(400).json({ mensaje: rango.error });
        }

        const paginacion = leerPaginacion(req.query);

        if (paginacion.error) {
            return res.status(400).json({ mensaje: paginacion.error });
        }

        const buscar = req.query.buscar ? String(req.query.buscar).trim() : undefined;
        const { condiciones, params } = condicionesBase({ ...rango, buscar });
        const where = ['usuario_id = ?', ...condiciones].join(' AND ');
        const parametros = [req.usuario.id, ...params];

        let consulta = `SELECT id, descripcion, valor, fecha
             FROM ingresos
             WHERE ${where}
             ORDER BY fecha DESC, id DESC`;
        let valores = parametros;

        if (paginacion.paginar) {
            const [conteo] = await pool.query(
                `SELECT COUNT(*) AS total FROM ingresos WHERE ${where}`,
                parametros
            );

            res.set('X-Total-Count', String(Number(conteo[0].total)));
            res.set('X-Page', String(paginacion.pagina));
            res.set('X-Limit', String(paginacion.limite));

            consulta += ' LIMIT ? OFFSET ?';
            valores = [...parametros, paginacion.limite, paginacion.offset];
        }

        const [ingresos] = await pool.query(consulta, valores);

        res.json(ingresos.map(normalizarMovimiento));

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar los ingresos'
        });
    }
});

app.get('/api/ingresos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [ingresos] = await pool.query(
            `SELECT id, descripcion, valor, fecha
             FROM ingresos
             WHERE id = ? AND usuario_id = ?`,
            [id, req.usuario.id]
        );

        if (ingresos.length === 0) {
            return res.status(404).json({
                mensaje: 'Ingreso no encontrado'
            });
        }

        res.json(normalizarMovimiento(ingresos[0]));

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar el ingreso'
        });
    }
});

app.put('/api/ingresos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { descripcion, valor, fecha } = req.body;

        if (!descripcion || valor === undefined || !fecha) {
            return res.status(400).json({
                mensaje: 'Descripción, valor y fecha son obligatorios'
            });
        }

        if (!(Number(valor) > 0)) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
            });
        }

        if (!esFechaValida(fecha)) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida. Use el formato AAAA-MM-DD'
            });
        }

        const [resultado] = await pool.query(
            `UPDATE ingresos
             SET descripcion = ?, valor = ?, fecha = ?
             WHERE id = ? AND usuario_id = ?`,
            [descripcion, valor, fecha, id, req.usuario.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Ingreso no encontrado'
            });
        }

        res.json({
            mensaje: 'Ingreso actualizado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al actualizar el ingreso'
        });
    }
});

app.delete('/api/ingresos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            `DELETE FROM ingresos
             WHERE id = ? AND usuario_id = ?`,
            [id, req.usuario.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Ingreso no encontrado'
            });
        }

        res.json({
            mensaje: 'Ingreso eliminado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al eliminar el ingreso'
        });
    }
});

app.post('/api/gastos', verificarToken, async (req, res) => {
    try {
        const {
            descripcion,
            valor,
            categoria,
            fecha
        } = req.body;

        if (!descripcion || valor === undefined || !categoria || !fecha) {
            return res.status(400).json({
                mensaje: 'Descripción, valor, categoría y fecha son obligatorios'
            });
        }

        if (!(Number(valor) > 0)) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
            });
        }

        if (!esFechaValida(fecha)) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida. Use el formato AAAA-MM-DD'
            });
        }

        const [resultado] = await pool.query(
            `INSERT INTO gastos
            (descripcion, valor, categoria, fecha, usuario_id)
            VALUES (?, ?, ?, ?, ?)`,
            [descripcion, valor, categoria, fecha, req.usuario.id]
        );

        res.status(201).json({
            mensaje: 'Gasto registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al registrar el gasto'
        });
    }
});

// Lista de gastos con filtros opcionales: desde, hasta, buscar, categoria, pagina y limite
async function consultarGastos(req, res, categoriaFija, mensajeError) {
    try {
        const rango = leerRangoFechas(req.query);

        if (rango.error) {
            return res.status(400).json({ mensaje: rango.error });
        }

        const paginacion = leerPaginacion(req.query);

        if (paginacion.error) {
            return res.status(400).json({ mensaje: paginacion.error });
        }

        const buscar = req.query.buscar ? String(req.query.buscar).trim() : undefined;
        const categoria = categoriaFija || (req.query.categoria ? String(req.query.categoria).trim() : undefined);
        const { condiciones, params } = condicionesBase({ ...rango, buscar });

        if (categoria) {
            condiciones.push('categoria = ?');
            params.push(categoria);
        }

        const where = ['usuario_id = ?', ...condiciones].join(' AND ');
        const parametros = [req.usuario.id, ...params];

        let consulta = `SELECT id, descripcion, valor, categoria, fecha
             FROM gastos
             WHERE ${where}
             ORDER BY fecha DESC, id DESC`;
        let valores = parametros;

        if (paginacion.paginar) {
            const [conteo] = await pool.query(
                `SELECT COUNT(*) AS total FROM gastos WHERE ${where}`,
                parametros
            );

            res.set('X-Total-Count', String(Number(conteo[0].total)));
            res.set('X-Page', String(paginacion.pagina));
            res.set('X-Limit', String(paginacion.limite));

            consulta += ' LIMIT ? OFFSET ?';
            valores = [...parametros, paginacion.limite, paginacion.offset];
        }

        const [gastos] = await pool.query(consulta, valores);

        res.json(gastos.map(normalizarMovimiento));

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: mensajeError
        });
    }
}

app.get('/api/gastos', verificarToken, (req, res) =>
    consultarGastos(req, res, undefined, 'Error al consultar los gastos')
);

app.get('/api/gastos/categoria/:categoria', verificarToken, (req, res) =>
    consultarGastos(req, res, req.params.categoria, 'Error al consultar los gastos por categoría')
);

app.get('/api/gastos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [gastos] = await pool.query(
            `SELECT id, descripcion, valor, categoria, fecha
             FROM gastos
             WHERE id = ? AND usuario_id = ?`,
            [id, req.usuario.id]
        );

        if (gastos.length === 0) {
            return res.status(404).json({
                mensaje: 'Gasto no encontrado'
            });
        }

        res.json(normalizarMovimiento(gastos[0]));

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar el gasto'
        });
    }
});

app.put('/api/gastos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const {
            descripcion,
            valor,
            categoria,
            fecha
        } = req.body;

        if (!descripcion || valor === undefined || !categoria || !fecha) {
            return res.status(400).json({
                mensaje: 'Descripción, valor, categoría y fecha son obligatorios'
            });
        }

        if (!(Number(valor) > 0)) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
            });
        }

        if (!esFechaValida(fecha)) {
            return res.status(400).json({
                mensaje: 'La fecha no es válida. Use el formato AAAA-MM-DD'
            });
        }

        const [resultado] = await pool.query(
            `UPDATE gastos
             SET descripcion = ?, valor = ?, categoria = ?, fecha = ?
             WHERE id = ? AND usuario_id = ?`,
            [descripcion, valor, categoria, fecha, id, req.usuario.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Gasto no encontrado'
            });
        }

        res.json({
            mensaje: 'Gasto actualizado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al actualizar el gasto'
        });
    }
});

app.delete('/api/gastos/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await pool.query(
            `DELETE FROM gastos
             WHERE id = ? AND usuario_id = ?`,
            [id, req.usuario.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Gasto no encontrado'
            });
        }

        res.json({
            mensaje: 'Gasto eliminado correctamente'
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al eliminar el gasto'
        });
    }
});

app.get('/api/saldo', verificarToken, async (req, res) => {
    try {
        const [ingresos] = await pool.query(
            `SELECT COALESCE(SUM(valor), 0) AS total
             FROM ingresos
             WHERE usuario_id = ?`,
            [req.usuario.id]
        );

        const [gastos] = await pool.query(
            `SELECT COALESCE(SUM(valor), 0) AS total
             FROM gastos
             WHERE usuario_id = ?`,
            [req.usuario.id]
        );

        const totalIngresos = Number(ingresos[0].total);
        const totalGastos = Number(gastos[0].total);
        const saldo = totalIngresos - totalGastos;

        res.json({
            totalIngresos: totalIngresos,
            totalGastos: totalGastos,
            saldo: saldo
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al calcular el saldo'
        });
    }
});

app.use('/api/usuarios', require('./routes/perfil'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/resumen', require('./routes/resumen'));

// Documentación Swagger (/api-docs)
app.use(require('./docs/swagger'));

// Rutas inexistentes
app.use((req, res) => {
    res.status(404).json({
        mensaje: 'Ruta no encontrada'
    });
});

// Errores no controlados (por ejemplo, JSON mal formado en el cuerpo)
app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            mensaje: 'El cuerpo de la solicitud no es un JSON válido'
        });
    }

    console.error(error);

    res.status(500).json({
        mensaje: 'Error interno del servidor'
    });
});

module.exports = app;