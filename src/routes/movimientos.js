const express = require('express');

const pool = require('../config/database');
const verificarToken = require('../middleware/auth');
const {
    leerRangoFechas,
    leerPaginacion,
    condicionesBase,
    normalizarMovimiento
} = require('../utils/filtros');

const router = express.Router();

const TIPOS = ['ingreso', 'gasto'];

// Arma la consulta que une ingresos y gastos en una sola lista ordenada por fecha.
function construirConsulta(usuarioId, { desde, hasta, buscar, tipo, categoria }) {
    const partes = [];
    const params = [];

    if (!tipo || tipo === 'ingreso') {
        if (!categoria) {
            const { condiciones, params: extra } = condicionesBase({ desde, hasta, buscar });

            partes.push(
                `SELECT 'ingreso' AS tipo, id, descripcion, valor, NULL AS categoria, fecha
                 FROM ingresos WHERE usuario_id = ? ${condiciones.map((c) => `AND ${c}`).join(' ')}`
            );
            params.push(usuarioId, ...extra);
        }
    }

    if (!tipo || tipo === 'gasto') {
        const { condiciones, params: extra } = condicionesBase({ desde, hasta, buscar });

        if (categoria) {
            condiciones.push('categoria = ?');
            extra.push(categoria);
        }

        partes.push(
            `SELECT 'gasto' AS tipo, id, descripcion, valor, categoria, fecha
             FROM gastos WHERE usuario_id = ? ${condiciones.map((c) => `AND ${c}`).join(' ')}`
        );
        params.push(usuarioId, ...extra);
    }

    return { sql: partes.join(' UNION ALL '), params };
}

// Valida los filtros comunes de las rutas de esta sección.
function leerFiltros(query) {
    const rango = leerRangoFechas(query);

    if (rango.error) {
        return { error: rango.error };
    }

    if (query.tipo !== undefined && !TIPOS.includes(query.tipo)) {
        return { error: 'El tipo debe ser "ingreso" o "gasto"' };
    }

    return {
        filtros: {
            desde: rango.desde,
            hasta: rango.hasta,
            tipo: query.tipo,
            buscar: query.buscar ? String(query.buscar).trim() : undefined,
            categoria: query.categoria ? String(query.categoria).trim() : undefined
        }
    };
}

// Protege contra "inyección de fórmulas" al abrir el CSV en Excel.
function celdaCsv(valor) {
    let texto = valor === null || valor === undefined ? '' : String(valor);

    if (/^[=+\-@\t\r]/.test(texto)) {
        texto = `'${texto}`;
    }

    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Movimientos (ingresos + gastos) con filtros y paginación opcional.
router.get('/', verificarToken, async (req, res) => {
    try {
        const { error, filtros } = leerFiltros(req.query);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const paginacion = leerPaginacion(req.query);

        if (paginacion.error) {
            return res.status(400).json({ mensaje: paginacion.error });
        }

        const { sql, params } = construirConsulta(req.usuario.id, filtros);

        if (!sql) {
            return res.json([]);
        }

        let consulta = `${sql} ORDER BY fecha DESC, tipo ASC, id DESC`;
        let parametros = params;

        if (paginacion.paginar) {
            const [conteo] = await pool.query(
                `SELECT COUNT(*) AS total FROM (${sql}) AS movimientos`,
                params
            );

            res.set('X-Total-Count', String(Number(conteo[0].total)));
            res.set('X-Page', String(paginacion.pagina));
            res.set('X-Limit', String(paginacion.limite));

            consulta += ' LIMIT ? OFFSET ?';
            parametros = [...params, paginacion.limite, paginacion.offset];
        }

        const [movimientos] = await pool.query(consulta, parametros);

        res.json(movimientos.map(normalizarMovimiento));

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al consultar los movimientos' });
    }
});

// Exportar los movimientos filtrados a un archivo CSV.
router.get('/exportar', verificarToken, async (req, res) => {
    try {
        const { error, filtros } = leerFiltros(req.query);

        if (error) {
            return res.status(400).json({ mensaje: error });
        }

        const { sql, params } = construirConsulta(req.usuario.id, filtros);
        const [movimientos] = sql
            ? await pool.query(`${sql} ORDER BY fecha DESC, tipo ASC, id DESC`, params)
            : [[]];

        const lineas = ['tipo,id,fecha,descripcion,categoria,valor'];

        for (const fila of movimientos.map(normalizarMovimiento)) {
            lineas.push(
                [fila.tipo, fila.id, fila.fecha, fila.descripcion, fila.categoria, fila.valor]
                    .map(celdaCsv)
                    .join(',')
            );
        }

        res.set('Content-Type', 'text/csv; charset=utf-8');
        res.set('Content-Disposition', 'attachment; filename="movimientos.csv"');
        res.send(`﻿${lineas.join('\r\n')}\r\n`);

    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'Error al exportar los movimientos' });
    }
});

module.exports = router;
