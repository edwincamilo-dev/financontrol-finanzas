require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('./config/database');
const verificarToken = require('./middleware/auth');

const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
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

app.post('/api/usuarios/registro', async (req, res) => {
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

app.post('/api/usuarios/login', async (req, res) => {
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

        if (Number(valor) <= 0) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
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
        const [ingresos] = await pool.query(
            `SELECT id, descripcion, valor, fecha
             FROM ingresos
             WHERE usuario_id = ?
             ORDER BY fecha DESC, id DESC`,
            [req.usuario.id]
        );

        res.json(ingresos);

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

        res.json(ingresos[0]);

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

        if (Number(valor) <= 0) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
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

        if (Number(valor) <= 0) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
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

app.get('/api/gastos', verificarToken, async (req, res) => {
    try {
        const [gastos] = await pool.query(
            `SELECT id, descripcion, valor, categoria, fecha
             FROM gastos
             WHERE usuario_id = ?
             ORDER BY fecha DESC, id DESC`,
            [req.usuario.id]
        );

        res.json(gastos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar los gastos'
        });
    }
});

app.get('/api/gastos/categoria/:categoria', verificarToken, async (req, res) => {
    try {
        const { categoria } = req.params;

        const [gastos] = await pool.query(
            `SELECT id, descripcion, valor, categoria, fecha
             FROM gastos
             WHERE categoria = ? AND usuario_id = ?
             ORDER BY fecha DESC, id DESC`,
            [categoria, req.usuario.id]
        );

        res.json(gastos);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            mensaje: 'Error al consultar los gastos por categoría'
        });
    }
});

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

        res.json(gastos[0]);

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

        if (Number(valor) <= 0) {
            return res.status(400).json({
                mensaje: 'El valor debe ser mayor que 0'
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

module.exports = app;