const express = require('express');

const verificarToken = require('../middleware/auth');
const cache = require('../middleware/cache');

const router = express.Router();

// Ver cómo está funcionando el caché del usuario (hits, misses, entradas).
router.get('/api/cache/estadisticas', verificarToken, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(cache.estadisticasDe(req.usuario.id));
});

// Invalidación manual: la próxima consulta vuelve a ser MISS.
router.delete('/api/cache', verificarToken, (req, res) => {
    const eliminadas = cache.invalidarUsuario(req.usuario.id);

    res.json({
        mensaje: 'Caché invalidado correctamente',
        entradasEliminadas: eliminadas
    });
});

module.exports = router;
