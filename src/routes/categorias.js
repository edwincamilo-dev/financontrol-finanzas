const express = require('express');

const pool = require('../config/database');
const verificarToken = require('../middleware/auth');
const { leerRangoFechas, condicionesBase, redondear } = require('../utils/filtros');

const router = express.Router();

// Categorías que el usuario ha usado, con cuántos gastos y cuánto suma cada una.
// Debe registrarse ANTES de /api/gastos/:id para que "categorias" no se tome como un id.
router.get('/api/gastos/categorias', verificarToken, async (req, res) => {
    try {
        const rango = leerRangoFechas(req.query);

        if (rango.error) {
            return res.status(400).json({ mensaje: rango.error });
        }

        const { condiciones, params } = condicionesBase(rango);

        const [filas] = await pool.query(
            `SELECT categoria, COUNT(*) AS cantidad, SUM(valor) AS total
             FROM gastos
             WHERE usuario_id = ? ${condiciones.map((c) => `AND ${c}`).join(' ')}
             GROUP BY categoria
             ORDER BY total DESC, categoria ASC`,
            [req.usuario.id, ...params]
        );

        const totalGeneral = filas.reduce((suma, fila) => suma + Number(fila.total), 0);

        res.json(
            filas.map((fila) => ({
                categoria: fila.categoria,
                cantidad: Number(fila.cantidad),
                total: Number(fila.total),
                porcentaje: totalGeneral === 0 ? 0 : redondear((Number(fila.total) / totalGeneral) * 100, 1)
            }))
        );

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al consultar las categorías' });
    }
});

module.exports = router;
