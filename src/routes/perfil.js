const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../config/database');
const verificarToken = require('../middleware/auth');

const router = express.Router();

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MINIMO_PASSWORD = 6;

function crearToken(usuario) {
    return jwt.sign(
        { id: usuario.id, correo: usuario.correo },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );
}

async function obtenerUsuario(id) {
    const [usuarios] = await pool.query(
        'SELECT id, nombre, correo, password FROM usuarios WHERE id = ?',
        [id]
    );

    return usuarios[0];
}

// Ver el perfil del usuario autenticado
router.get('/perfil', verificarToken, async (req, res) => {
    try {
        const usuario = await obtenerUsuario(req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json({
            id: usuario.id,
            nombre: usuario.nombre,
            correo: usuario.correo
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al consultar el perfil' });
    }
});

// Editar nombre y/o correo
router.put('/perfil', verificarToken, async (req, res) => {
    try {
        const { nombre, correo } = req.body;

        if (nombre === undefined && correo === undefined) {
            return res.status(400).json({
                mensaje: 'Debe enviar al menos el nombre o el correo'
            });
        }

        if (nombre !== undefined && (typeof nombre !== 'string' || nombre.trim() === '')) {
            return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
        }

        if (correo !== undefined && (typeof correo !== 'string' || !REGEX_CORREO.test(correo))) {
            return res.status(400).json({ mensaje: 'El correo no es válido' });
        }

        const actual = await obtenerUsuario(req.usuario.id);

        if (!actual) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        if (correo !== undefined && correo !== actual.correo) {
            const [repetidos] = await pool.query(
                'SELECT id FROM usuarios WHERE correo = ? AND id <> ?',
                [correo, actual.id]
            );

            if (repetidos.length > 0) {
                return res.status(400).json({ mensaje: 'El correo ya está registrado' });
            }
        }

        const nuevoNombre = nombre !== undefined ? nombre.trim() : actual.nombre;
        const nuevoCorreo = correo !== undefined ? correo : actual.correo;

        await pool.query(
            'UPDATE usuarios SET nombre = ?, correo = ? WHERE id = ?',
            [nuevoNombre, nuevoCorreo, actual.id]
        );

        const usuario = { id: actual.id, nombre: nuevoNombre, correo: nuevoCorreo };

        // El token lleva el correo; se entrega uno nuevo para que quede al día.
        res.json({
            mensaje: 'Perfil actualizado correctamente',
            usuario,
            token: crearToken(usuario)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
    }
});

// Cambiar contraseña
router.put('/password', verificarToken, async (req, res) => {
    try {
        const { passwordActual, passwordNueva } = req.body;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({
                mensaje: 'La contraseña actual y la nueva son obligatorias'
            });
        }

        if (typeof passwordNueva !== 'string' || passwordNueva.length < LARGO_MINIMO_PASSWORD) {
            return res.status(400).json({
                mensaje: `La nueva contraseña debe tener al menos ${LARGO_MINIMO_PASSWORD} caracteres`
            });
        }

        if (passwordActual === passwordNueva) {
            return res.status(400).json({
                mensaje: 'La nueva contraseña debe ser diferente a la actual'
            });
        }

        const usuario = await obtenerUsuario(req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        const correcta = await bcrypt.compare(passwordActual, usuario.password);

        if (!correcta) {
            return res.status(401).json({ mensaje: 'La contraseña actual es incorrecta' });
        }

        const hash = await bcrypt.hash(passwordNueva, 10);

        await pool.query(
            'UPDATE usuarios SET password = ? WHERE id = ?',
            [hash, usuario.id]
        );

        res.json({ mensaje: 'Contraseña actualizada correctamente' });

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al cambiar la contraseña' });
    }
});

// Eliminar la cuenta junto con todos sus ingresos y gastos
router.delete('/cuenta', verificarToken, async (req, res) => {
    let conexion;

    try {
        const { password } = req.body || {};

        if (!password) {
            return res.status(400).json({
                mensaje: 'La contraseña es obligatoria para eliminar la cuenta'
            });
        }

        const usuario = await obtenerUsuario(req.usuario.id);

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        const correcta = await bcrypt.compare(password, usuario.password);

        if (!correcta) {
            return res.status(401).json({ mensaje: 'La contraseña es incorrecta' });
        }

        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        await conexion.query('DELETE FROM ingresos WHERE usuario_id = ?', [usuario.id]);
        await conexion.query('DELETE FROM gastos WHERE usuario_id = ?', [usuario.id]);
        await conexion.query('DELETE FROM usuarios WHERE id = ?', [usuario.id]);

        await conexion.commit();

        res.json({ mensaje: 'Cuenta eliminada correctamente' });

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        console.error(error);

        res.status(500).json({ mensaje: 'Error al eliminar la cuenta' });

    } finally {
        if (conexion) {
            conexion.release();
        }
    }
});

module.exports = router;
