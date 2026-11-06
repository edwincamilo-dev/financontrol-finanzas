const express = require('express');

const pool = require('../config/database');
const verificarToken = require('../middleware/auth');
const { leerRangoFechas, condicionesBase, redondear } = require('../utils/filtros');

const router = express.Router();

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// Resumen financiero de un periodo: totales, saldo y gastos por categoría.
router.get('/', verificarToken, async (req, res) => {
    try {
        const rango = leerRangoFechas(req.query);

        if (rango.error) {
            return res.status(400).json({ mensaje: rango.error });
        }

        const { condiciones, params } = condicionesBase(rango);
        const extra = condiciones.map((c) => `AND ${c}`).join(' ');
        const parametros = [req.usuario.id, ...params];

        const [ingresos] = await pool.query(
            `SELECT COUNT(*) AS cantidad, COALESCE(SUM(valor), 0) AS total
             FROM ingresos WHERE usuario_id = ? ${extra}`,
            parametros
        );

        const [gastos] = await pool.query(
            `SELECT COUNT(*) AS cantidad, COALESCE(SUM(valor), 0) AS total
             FROM gastos WHERE usuario_id = ? ${extra}`,
            parametros
        );

        const [porCategoria] = await pool.query(
            `SELECT categoria, COUNT(*) AS cantidad, SUM(valor) AS total
             FROM gastos WHERE usuario_id = ? ${extra}
             GROUP BY categoria
             ORDER BY total DESC, categoria ASC`,
            parametros
        );

        const totalIngresos = Number(ingresos[0].total);
        const totalGastos = Number(gastos[0].total);

        res.json({
            periodo: { desde: rango.desde, hasta: rango.hasta },
            totalIngresos,
            totalGastos,
            saldo: redondear(totalIngresos - totalGastos),
            cantidadIngresos: Number(ingresos[0].cantidad),
            cantidadGastos: Number(gastos[0].cantidad),
            gastosPorCategoria: porCategoria.map((fila) => ({
                categoria: fila.categoria,
                cantidad: Number(fila.cantidad),
                total: Number(fila.total),
                porcentaje: totalGastos === 0 ? 0 : redondear((Number(fila.total) / totalGastos) * 100, 1)
            }))
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al calcular el resumen' });
    }
});

// Resumen mes a mes de un año (por defecto el año actual).
router.get('/mensual', verificarToken, async (req, res) => {
    try {
        const anio = req.query.anio === undefined ? new Date().getFullYear() : Number(req.query.anio);

        if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
            return res.status(400).json({ mensaje: 'El año debe ser un número entre 1900 y 2100' });
        }

        const desde = `${anio}-01-01`;
        const hasta = `${anio}-12-31`;

        const consultaMensual = (tabla) => pool.query(
            `SELECT MONTH(fecha) AS mes, SUM(valor) AS total
             FROM ${tabla}
             WHERE usuario_id = ? AND DATE(fecha) >= ? AND DATE(fecha) <= ?
             GROUP BY MONTH(fecha)`,
            [req.usuario.id, desde, hasta]
        );

        const [[ingresos], [gastos]] = await Promise.all([
            consultaMensual('ingresos'),
            consultaMensual('gastos')
        ]);

        const meses = MESES.map((nombre, indice) => {
            const ingresosMes = Number((ingresos.find((f) => Number(f.mes) === indice + 1) || {}).total || 0);
            const gastosMes = Number((gastos.find((f) => Number(f.mes) === indice + 1) || {}).total || 0);

            return {
                mes: indice + 1,
                nombre,
                ingresos: ingresosMes,
                gastos: gastosMes,
                saldo: redondear(ingresosMes - gastosMes)
            };
        });

        const totalIngresos = redondear(meses.reduce((suma, m) => suma + m.ingresos, 0));
        const totalGastos = redondear(meses.reduce((suma, m) => suma + m.gastos, 0));

        res.json({
            anio,
            totalIngresos,
            totalGastos,
            saldo: redondear(totalIngresos - totalGastos),
            meses
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al calcular el resumen mensual' });
    }
});

module.exports = router;
