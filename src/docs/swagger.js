// Documentación interactiva (Swagger UI) de la API.
//
//   GET /api-docs                Página de Swagger UI (se puede probar cada endpoint desde ahí)
//   GET /api-docs/openapi.json   El contrato OpenAPI (docs/openapi.json)
//
// No requiere instalar paquetes: la página carga Swagger UI desde un CDN, por lo que el navegador
// necesita conexión a internet. Este archivo vive fuera de src/routes a propósito: las pruebas de
// contrato solo comparan las rutas de la API con docs/openapi.json, no las de la documentación.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const { DIRECTIVAS_CSP } = require('../config/seguridad');

const router = express.Router();

const RUTA_CONTRATO = path.join(__dirname, '..', '..', 'docs', 'openapi.json');
const VERSION_SWAGGER_UI = '5.17.14';
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${VERSION_SWAGGER_UI}`;

const ORIGEN_CDN = 'https://cdn.jsdelivr.net';

// El estilo y el script en línea de la página llevan un nonce aleatorio por petición:
// la CSP los permite sin abrir 'unsafe-inline' a cualquier otro código.
const pagina = (nonce) => `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FinanControl API - Documentación</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css">
  <style nonce="${nonce}">
    body { margin: 0; background: #fafafa; }
    #aviso { display: none; max-width: 640px; margin: 48px auto; padding: 0 16px; font: 16px/1.5 system-ui, sans-serif; }
    #aviso a { color: #0b6b5c; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <div id="aviso">
    <h1>No se pudo cargar Swagger UI</h1>
    <p>La documentación se muestra con Swagger UI desde un CDN y necesita conexión a internet.
       Mientras tanto puedes leer el contrato en
       <a href="/api-docs/openapi.json">/api-docs/openapi.json</a>.</p>
  </div>
  <script src="${CDN}/swagger-ui-bundle.js"></script>
  <script nonce="${nonce}">
    // "load" llega aunque el CDN falle; si Swagger UI no cargó, se muestra el aviso.
    window.addEventListener('load', function () {
      if (!window.SwaggerUIBundle) { document.getElementById('aviso').style.display = 'block'; return; }
      window.ui = SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 0,
        validatorUrl: null
      });
    });
  </script>
</body>
</html>
`;

// CSP propia de /api-docs: la de la app más el CDN de Swagger UI y el nonce de esta respuesta.
const cspDocumentacion = helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
        ...DIRECTIVAS_CSP,
        'script-src': ["'self'", ORIGEN_CDN, (req, res) => `'nonce-${res.locals.nonce}'`],
        'style-src': ["'self'", ORIGEN_CDN, (req, res) => `'nonce-${res.locals.nonce}'`]
    }
});

router.get('/api-docs', (req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
}, cspDocumentacion, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(pagina(res.locals.nonce));
});

// El contrato se entrega con "servers" apuntando a la dirección desde la que se está consultando,
// así el botón "Try it out" siempre llama al mismo origen (sin problemas de CORS).
router.get('/api-docs/openapi.json', (req, res) => {
    try {
        const contrato = JSON.parse(fs.readFileSync(RUTA_CONTRATO, 'utf8'));

        contrato.servers = [{ url: `${req.protocol}://${req.get('host')}`, description: 'Este servidor' }];

        res.set('Cache-Control', 'no-cache');
        res.json(contrato);
    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'No se pudo leer el contrato OpenAPI' });
    }
});

module.exports = router;
